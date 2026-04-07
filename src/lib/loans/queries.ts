import "server-only";

import { prisma } from "@/lib/prisma";
import { LOAN_SELECT, toLoanView, type LoanView } from "./types";

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
