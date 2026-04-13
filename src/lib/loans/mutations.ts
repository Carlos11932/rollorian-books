import "server-only";

import { Prisma, type OwnershipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getUserBookCompatAttempts,
  isMissingUserBookSchemaError,
  isRetryableUserBookCompatError,
} from "@/lib/prisma-schema-compat";
import { revalidateBookCollectionPaths } from "@/lib/revalidation";
import { LOAN_SELECT, toLoanView, type LoanView } from "./types";
import {
  LoanNotFoundError,
  LoanForbiddenError,
  LoanInvalidTransitionError,
  LoanBookNotInLibraryError,
  LoanBookNotOwnedError,
  LoanOwnershipVerificationUnavailableError,
  LoanSelfBorrowError,
  LoanWriteConflictError,
} from "./errors";

const EXCLUSIVE_LOAN_STATUSES = ["REQUESTED", "OFFERED", "ACTIVE"] as const;
const LOAN_WRITE_RETRY_LIMIT = 3;

type LoanMutationClient = Pick<Prisma.TransactionClient, "loan" | "userBook">;

type LoanUserBookLookup = {
  id: string;
  ownershipStatus: OwnershipStatus | "UNKNOWN";
  ownershipSource: "stored" | "missing-column";
};

function isTransactionWriteConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

function createLoanWriteConflictError(
  action: "create the loan" | "accept the loan" | "decline the loan" | "return the loan",
): LoanWriteConflictError {
  return new LoanWriteConflictError(action);
}

async function findLoanUserBook(
  client: LoanMutationClient,
  userId: string,
  bookId: string,
): Promise<LoanUserBookLookup | null> {
  const attempts = getUserBookCompatAttempts({
    includeOwnershipStatus: true,
    includeFinishedAt: false,
  });

  let lastError: unknown;

  for (const attempt of attempts) {
    try {
      if (attempt.includeOwnershipStatus) {
        const userBook = await client.userBook.findUnique({
          where: { userId_bookId: { userId, bookId } },
          select: { id: true, ownershipStatus: true },
        });

        return userBook ? { ...userBook, ownershipSource: "stored" } : null;
      }

        const userBook = await client.userBook.findUnique({
          where: { userId_bookId: { userId, bookId } },
          select: { id: true },
        });

        return userBook
          ? { ...userBook, ownershipStatus: "UNKNOWN", ownershipSource: "missing-column" }
          : null;
    } catch (error) {
      if (isMissingUserBookSchemaError(error)) {
        throw new LoanOwnershipVerificationUnavailableError();
      }

      lastError = error;
      if (!isRetryableUserBookCompatError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

async function assertLenderCanLoanBook(
  client: LoanMutationClient,
  lenderId: string,
  bookId: string,
): Promise<void> {
  const lenderBook = await findLoanUserBook(client, lenderId, bookId);

  if (!lenderBook) throw new LoanBookNotInLibraryError();
  if (lenderBook.ownershipSource === "missing-column") {
    throw new LoanOwnershipVerificationUnavailableError();
  }
  if (lenderBook.ownershipStatus !== "OWNED") throw new LoanBookNotOwnedError();
}

async function createExclusiveLoan(
  lenderId: string,
  borrowerId: string,
  bookId: string,
  status: "REQUESTED" | "OFFERED",
): Promise<LoanView> {
  if (lenderId === borrowerId) {
    throw new LoanSelfBorrowError();
  }

  for (let attempt = 0; attempt < LOAN_WRITE_RETRY_LIMIT; attempt += 1) {
    try {
      const loan = await prisma.$transaction(async (tx) => {
        await assertLenderCanLoanBook(tx, lenderId, bookId);

        const existingLenderLoan = await tx.loan.findFirst({
          where: {
            lenderId,
            bookId,
            status: { in: EXCLUSIVE_LOAN_STATUSES.slice() },
          },
          select: { id: true },
        });

        if (existingLenderLoan) {
          throw new LoanInvalidTransitionError("This book is already involved in an active loan");
        }

        return tx.loan.create({
          data: {
            lenderId,
            borrowerId,
            bookId,
            status,
          },
          select: LOAN_SELECT,
        });
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });

      return toLoanView(loan);
    } catch (error) {
      if (!isTransactionWriteConflict(error)) {
        throw error;
      }

    }
  }

  const existingLenderLoan = await prisma.loan.findFirst({
    where: {
      lenderId,
      bookId,
      status: { in: EXCLUSIVE_LOAN_STATUSES.slice() },
    },
    select: { id: true },
  });

  if (existingLenderLoan) {
    throw new LoanInvalidTransitionError("This book is already involved in an active loan");
  }

  throw createLoanWriteConflictError("create the loan");
}

async function throwStaleTransitionError(
  loanId: string,
  action: "accept" | "decline" | "return",
): Promise<never> {
  const latestLoan = await prisma.loan.findUnique({
    where: { id: loanId },
    select: { status: true },
  });

  if (!latestLoan) {
    throw new LoanNotFoundError();
  }

  throw new LoanInvalidTransitionError(`Cannot ${action} a loan with status ${latestLoan.status}`);
}

// ── Request to borrow ───────────────────────────────────────────────────────

export async function requestLoan(
  borrowerId: string,
  lenderId: string,
  bookId: string,
): Promise<LoanView> {
  return createExclusiveLoan(lenderId, borrowerId, bookId, "REQUESTED");
}

// ── Offer to lend ───────────────────────────────────────────────────────────

export async function offerLoan(
  lenderId: string,
  borrowerId: string,
  bookId: string,
): Promise<LoanView> {
  return createExclusiveLoan(lenderId, borrowerId, bookId, "OFFERED");
}

// ── Accept (REQUESTED → ACTIVE or OFFERED → ACTIVE) ────────────────────────

export async function acceptLoan(
  loanId: string,
  userId: string,
): Promise<LoanView> {
  for (let attempt = 0; attempt < LOAN_WRITE_RETRY_LIMIT; attempt += 1) {
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: { ...LOAN_SELECT, updatedAt: true },
    });

    if (!loan) throw new LoanNotFoundError();

    // Only the OTHER party can accept
    if (loan.status === "REQUESTED" && loan.lenderId !== userId) {
      throw new LoanForbiddenError();
    }
    if (loan.status === "OFFERED" && loan.borrowerId !== userId) {
      throw new LoanForbiddenError();
    }
    if (loan.status !== "REQUESTED" && loan.status !== "OFFERED") {
      throw new LoanInvalidTransitionError(`Cannot accept a loan with status ${loan.status}`);
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        await assertLenderCanLoanBook(tx, loan.lenderId, loan.bookId);

        const activatedLoan = await tx.loan.updateMany({
          where: {
            id: loanId,
            status: loan.status,
            updatedAt: loan.updatedAt,
          },
          data: { status: "ACTIVE" },
        });

        if (activatedLoan.count !== 1) {
          return null;
        }

        return { ...loan, status: "ACTIVE" as const };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });

      if (!updated) {
        return await throwStaleTransitionError(loanId, "accept");
      }

      revalidateBookCollectionPaths(loan.bookId);
      return toLoanView(updated);
    } catch (error) {
      if (!isTransactionWriteConflict(error)) {
        throw error;
      }

    }
  }

  const latestLoan = await prisma.loan.findUnique({
    where: { id: loanId },
    select: { status: true },
  });

  if (!latestLoan) {
    throw new LoanNotFoundError();
  }

  if (latestLoan.status !== "REQUESTED" && latestLoan.status !== "OFFERED") {
    throw new LoanInvalidTransitionError(`Cannot accept a loan with status ${latestLoan.status}`);
  }

  throw createLoanWriteConflictError("accept the loan");
}

// ── Decline (REQUESTED → DECLINED or OFFERED → DECLINED) ───────────────────

export async function declineLoan(
  loanId: string,
  userId: string,
): Promise<LoanView> {
  for (let attempt = 0; attempt < LOAN_WRITE_RETRY_LIMIT; attempt += 1) {
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: { ...LOAN_SELECT, updatedAt: true },
    });

    if (!loan) throw new LoanNotFoundError();

    // The other party declines, or the initiator cancels
    if (loan.lenderId !== userId && loan.borrowerId !== userId) {
      throw new LoanForbiddenError();
    }
    if (loan.status !== "REQUESTED" && loan.status !== "OFFERED") {
      throw new LoanInvalidTransitionError(`Cannot decline a loan with status ${loan.status}`);
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const declinedLoan = await tx.loan.updateMany({
          where: {
            id: loanId,
            status: loan.status,
            updatedAt: loan.updatedAt,
          },
          data: { status: "DECLINED" },
        });

        if (declinedLoan.count !== 1) {
          return null;
        }

        return { ...loan, status: "DECLINED" as const };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });

      if (!updated) {
        return await throwStaleTransitionError(loanId, "decline");
      }

      return toLoanView(updated);
    } catch (error) {
      if (!isTransactionWriteConflict(error)) {
        throw error;
      }
    }
  }

  const latestLoan = await prisma.loan.findUnique({
    where: { id: loanId },
    select: { status: true },
  });

  if (!latestLoan) {
    throw new LoanNotFoundError();
  }

  if (latestLoan.status !== "REQUESTED" && latestLoan.status !== "OFFERED") {
    throw new LoanInvalidTransitionError(`Cannot decline a loan with status ${latestLoan.status}`);
  }

  throw createLoanWriteConflictError("decline the loan");
}

// ── Return (ACTIVE → RETURNED) ─────────────────────────────────────────────

export async function returnLoan(
  loanId: string,
  userId: string,
): Promise<LoanView> {
  for (let attempt = 0; attempt < LOAN_WRITE_RETRY_LIMIT; attempt += 1) {
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: { ...LOAN_SELECT, updatedAt: true },
    });

    if (!loan) throw new LoanNotFoundError();

    // Either party can mark as returned
    if (loan.lenderId !== userId && loan.borrowerId !== userId) {
      throw new LoanForbiddenError();
    }
    if (loan.status !== "ACTIVE") {
      throw new LoanInvalidTransitionError(`Cannot return a loan with status ${loan.status}`);
    }

    // Return loan atomically.
    //
    // IMPORTANT: we intentionally do NOT auto-delete the borrower UserBook row.
    // The current schema has no immutable provenance marker for synthetic
    // loan-created tracking rows, and fields like status/notes/rating/
    // ownershipStatus are user-editable. Deleting based on those values risks
    // removing legitimate borrower library entries.
    try {
      const updated = await prisma.$transaction(async (tx) => {
        const returnedLoan = await tx.loan.updateMany({
          where: {
            id: loanId,
            status: loan.status,
            updatedAt: loan.updatedAt,
          },
          data: { status: "RETURNED" },
        });

        if (returnedLoan.count !== 1) {
          return null;
        }

        return { ...loan, status: "RETURNED" as const };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });

      if (!updated) {
        return await throwStaleTransitionError(loanId, "return");
      }

      revalidateBookCollectionPaths(loan.bookId);
      return toLoanView(updated);
    } catch (error) {
      if (!isTransactionWriteConflict(error)) {
        throw error;
      }
    }
  }

  const latestLoan = await prisma.loan.findUnique({
    where: { id: loanId },
    select: { status: true },
  });

  if (!latestLoan) {
    throw new LoanNotFoundError();
  }

  if (latestLoan.status !== "ACTIVE") {
    throw new LoanInvalidTransitionError(`Cannot return a loan with status ${latestLoan.status}`);
  }

  throw createLoanWriteConflictError("return the loan");
}
