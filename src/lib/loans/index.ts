import "server-only";

import { prisma } from "@/lib/prisma";
import { revalidateBookCollectionPaths } from "@/lib/revalidation";

// ── Types ───────────────────────────────────────────────────────────────────

export interface LoanView {
  id: string;
  bookId: string;
  bookTitle: string;
  bookCoverUrl: string | null;
  bookAuthors: string[];
  lenderId: string;
  lenderName: string | null;
  lenderImage: string | null;
  borrowerId: string;
  borrowerName: string | null;
  borrowerImage: string | null;
  status: string;
  createdAt: string;
}

const LOAN_SELECT = {
  id: true,
  bookId: true,
  status: true,
  createdAt: true,
  lenderId: true,
  borrowerId: true,
  book: {
    select: { title: true, coverUrl: true, authors: true },
  },
  lender: {
    select: { id: true, name: true, image: true },
  },
  borrower: {
    select: { id: true, name: true, image: true },
  },
} as const;

function toLoanView(loan: {
  id: string;
  bookId: string;
  status: string;
  createdAt: Date;
  lenderId: string;
  borrowerId: string;
  book: { title: string; coverUrl: string | null; authors: string[] };
  lender: { id: string; name: string | null; image: string | null };
  borrower: { id: string; name: string | null; image: string | null };
}): LoanView {
  return {
    id: loan.id,
    bookId: loan.bookId,
    bookTitle: loan.book.title,
    bookCoverUrl: loan.book.coverUrl,
    bookAuthors: loan.book.authors,
    lenderId: loan.lenderId,
    lenderName: loan.lender.name,
    lenderImage: loan.lender.image,
    borrowerId: loan.borrowerId,
    borrowerName: loan.borrower.name,
    borrowerImage: loan.borrower.image,
    status: loan.status,
    createdAt: loan.createdAt.toISOString(),
  };
}

// ── Errors ──────────────────────────────────────────────────────────────────

export class LoanNotFoundError extends Error {
  constructor() { super("Loan not found"); }
}

export class LoanForbiddenError extends Error {
  constructor() { super("Not authorized for this loan"); }
}

export class LoanInvalidTransitionError extends Error {
  constructor(msg: string) { super(msg); }
}

export class LoanBookNotInLibraryError extends Error {
  constructor() { super("Book is not in the lender's library"); }
}

// ── Get loans for a user ────────────────────────────────────────────────────

export async function getUserLoans(userId: string): Promise<LoanView[]> {
  const loans = await prisma.loan.findMany({
    where: {
      OR: [{ lenderId: userId }, { borrowerId: userId }],
      status: { in: ["REQUESTED", "OFFERED", "ACTIVE"] },
    },
    select: LOAN_SELECT,
    orderBy: { updatedAt: "desc" },
  });

  return loans.map(toLoanView);
}

// ── Get active loan for a specific book ─────────────────────────────────────

export async function getActiveLoanForBook(
  bookId: string,
  userId: string,
): Promise<LoanView | null> {
  const loan = await prisma.loan.findFirst({
    where: {
      bookId,
      status: { in: ["REQUESTED", "OFFERED", "ACTIVE"] },
      OR: [{ lenderId: userId }, { borrowerId: userId }],
    },
    select: LOAN_SELECT,
  });

  return loan ? toLoanView(loan) : null;
}

// ── Request to borrow ───────────────────────────────────────────────────────

export async function requestLoan(
  borrowerId: string,
  lenderId: string,
  bookId: string,
): Promise<LoanView> {
  // Verify the lender actually has this book
  const lenderBook = await prisma.userBook.findUnique({
    where: { userId_bookId: { userId: lenderId, bookId } },
    select: { id: true },
  });

  if (!lenderBook) throw new LoanBookNotInLibraryError();

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
  // Verify the lender actually has this book
  const lenderBook = await prisma.userBook.findUnique({
    where: { userId_bookId: { userId: lenderId, bookId } },
    select: { id: true },
  });

  if (!lenderBook) throw new LoanBookNotInLibraryError();

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

  // Activate the loan
  const updated = await prisma.loan.update({
    where: { id: loanId },
    data: { status: "ACTIVE" },
    select: LOAN_SELECT,
  });

  // Create UserBook for borrower if they don't have one
  await prisma.userBook.upsert({
    where: { userId_bookId: { userId: loan.borrowerId, bookId: loan.bookId } },
    create: {
      userId: loan.borrowerId,
      bookId: loan.bookId,
      status: "READING",
    },
    update: {},
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

  const updated = await prisma.loan.update({
    where: { id: loanId },
    data: { status: "RETURNED" },
    select: LOAN_SELECT,
  });

  // If borrower didn't finish (status != READ), remove their UserBook
  const borrowerBook = await prisma.userBook.findUnique({
    where: { userId_bookId: { userId: loan.borrowerId, bookId: loan.bookId } },
    select: { id: true, status: true },
  });

  if (borrowerBook && borrowerBook.status !== "READ") {
    await prisma.userBook.delete({
      where: { id: borrowerBook.id },
    });
  }

  revalidateBookCollectionPaths(loan.bookId);
  return toLoanView(updated);
}
