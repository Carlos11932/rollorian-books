import "server-only";

import { prisma } from "@/lib/prisma";
import { revalidateBookCollectionPaths } from "@/lib/revalidation";
import { LOAN_SELECT, toLoanView, type LoanView } from "./types";
import {
  LoanNotFoundError,
  LoanForbiddenError,
  LoanInvalidTransitionError,
  LoanBookNotInLibraryError,
  LoanBookNotOwnedError,
} from "./errors";

// ── Request to borrow ───────────────────────────────────────────────────────

export async function requestLoan(
  borrowerId: string,
  lenderId: string,
  bookId: string,
): Promise<LoanView> {
  // Verify the lender actually has this book and owns it
  const lenderBook = await prisma.userBook.findUnique({
    where: { userId_bookId: { userId: lenderId, bookId } },
    select: { id: true, ownershipStatus: true },
  });

  if (!lenderBook) throw new LoanBookNotInLibraryError();
  if (lenderBook.ownershipStatus !== "OWNED") throw new LoanBookNotOwnedError();

  // Prevent lending the same physical book to multiple borrowers simultaneously
  const existingLenderLoan = await prisma.loan.findFirst({
    where: {
      lenderId,
      bookId,
      status: { in: ["REQUESTED", "OFFERED", "ACTIVE"] },
    },
    select: { id: true },
  });

  if (existingLenderLoan) {
    throw new LoanInvalidTransitionError("This book is already involved in an active loan");
  }

  const loan = await prisma.loan.create({
    data: {
      lenderId,
      borrowerId,
      bookId,
      status: "REQUESTED",
    },
    select: LOAN_SELECT,
  });

  return toLoanView(loan);
}

// ── Offer to lend ───────────────────────────────────────────────────────────

export async function offerLoan(
  lenderId: string,
  borrowerId: string,
  bookId: string,
): Promise<LoanView> {
  // Verify the lender actually has this book and owns it
  const lenderBook = await prisma.userBook.findUnique({
    where: { userId_bookId: { userId: lenderId, bookId } },
    select: { id: true, ownershipStatus: true },
  });

  if (!lenderBook) throw new LoanBookNotInLibraryError();
  if (lenderBook.ownershipStatus !== "OWNED") throw new LoanBookNotOwnedError();

  // Prevent lending the same physical book to multiple borrowers simultaneously
  const existingLenderLoan = await prisma.loan.findFirst({
    where: {
      lenderId,
      bookId,
      status: { in: ["REQUESTED", "OFFERED", "ACTIVE"] },
    },
    select: { id: true },
  });

  if (existingLenderLoan) {
    throw new LoanInvalidTransitionError("This book is already involved in an active loan");
  }

  const loan = await prisma.loan.create({
    data: {
      lenderId,
      borrowerId,
      bookId,
      status: "OFFERED",
    },
    select: LOAN_SELECT,
  });

  return toLoanView(loan);
}

// ── Accept (REQUESTED → ACTIVE or OFFERED → ACTIVE) ────────────────────────

export async function acceptLoan(
  loanId: string,
  userId: string,
): Promise<LoanView> {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    select: { ...LOAN_SELECT, status: true, lenderId: true, borrowerId: true },
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

  // Activate loan + create borrower UserBook atomically
  const updated = await prisma.$transaction(async (tx) => {
    const activatedLoan = await tx.loan.update({
      where: { id: loanId },
      data: { status: "ACTIVE" },
      select: LOAN_SELECT,
    });

    await tx.userBook.upsert({
      where: { userId_bookId: { userId: loan.borrowerId, bookId: loan.bookId } },
      create: {
        userId: loan.borrowerId,
        bookId: loan.bookId,
        status: "READING",
        ownershipStatus: "NOT_OWNED",
      },
      update: { status: "READING" },
    });

    return activatedLoan;
  });

  revalidateBookCollectionPaths(loan.bookId);
  return toLoanView(updated);
}

// ── Decline (REQUESTED → DECLINED or OFFERED → DECLINED) ───────────────────

export async function declineLoan(
  loanId: string,
  userId: string,
): Promise<LoanView> {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    select: LOAN_SELECT,
  });

  if (!loan) throw new LoanNotFoundError();

  // The other party declines, or the initiator cancels
  if (loan.lenderId !== userId && loan.borrowerId !== userId) {
    throw new LoanForbiddenError();
  }
  if (loan.status !== "REQUESTED" && loan.status !== "OFFERED") {
    throw new LoanInvalidTransitionError(`Cannot decline a loan with status ${loan.status}`);
  }

  const updated = await prisma.loan.update({
    where: { id: loanId },
    data: { status: "DECLINED" },
    select: LOAN_SELECT,
  });

  return toLoanView(updated);
}

// ── Return (ACTIVE → RETURNED) ─────────────────────────────────────────────

export async function returnLoan(
  loanId: string,
  userId: string,
): Promise<LoanView> {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    select: LOAN_SELECT,
  });

  if (!loan) throw new LoanNotFoundError();

  // Either party can mark as returned
  if (loan.lenderId !== userId && loan.borrowerId !== userId) {
    throw new LoanForbiddenError();
  }
  if (loan.status !== "ACTIVE") {
    throw new LoanInvalidTransitionError(`Cannot return a loan with status ${loan.status}`);
  }

  // Return loan + clean up borrower UserBook atomically
  const updated = await prisma.$transaction(async (tx) => {
    const returnedLoan = await tx.loan.update({
      where: { id: loanId },
      data: { status: "RETURNED" },
      select: LOAN_SELECT,
    });

    // If borrower didn't finish (status != READ), remove their UserBook
    const borrowerBook = await tx.userBook.findUnique({
      where: { userId_bookId: { userId: loan.borrowerId, bookId: loan.bookId } },
      select: { id: true, status: true },
    });

    if (borrowerBook && borrowerBook.status !== "READ") {
      await tx.userBook.delete({
        where: { id: borrowerBook.id },
      });
    }

    return returnedLoan;
  });

  revalidateBookCollectionPaths(loan.bookId);
  return toLoanView(updated);
}
