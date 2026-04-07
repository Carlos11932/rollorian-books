import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock prisma before any import that touches it ────────────────────────────

const {
  loanFindManyMock,
  loanFindFirstMock,
} = vi.hoisted(() => ({
  loanFindManyMock: vi.fn(),
  loanFindFirstMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    loan: {
      findMany: loanFindManyMock,
      findFirst: loanFindFirstMock,
    },
  },
}));

import { getUserLoans, getActiveLoanForBook } from "../queries";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePrismaLoan(overrides: Record<string, unknown> = {}) {
  return {
    id: "loan-001",
    bookId: "book-001",
    status: "REQUESTED",
    createdAt: new Date("2024-01-15T10:00:00.000Z"),
    lenderId: "user-lender",
    borrowerId: "user-borrower",
    book: {
      title: "Clean Code",
      coverUrl: "https://example.com/cover.jpg",
      authors: ["Robert C. Martin"],
    },
    lender: {
      id: "user-lender",
      name: "Alice",
      image: "https://example.com/alice.jpg",
    },
    borrower: {
      id: "user-borrower",
      name: "Bob",
      image: null,
    },
    ...overrides,
  };
}

// ─── getUserLoans ─────────────────────────────────────────────────────────────

describe("getUserLoans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty array when there are no loans for the user", async () => {
    loanFindManyMock.mockResolvedValueOnce([]);

    const result = await getUserLoans("user-001");

    expect(result).toEqual([]);
    expect(loanFindManyMock).toHaveBeenCalledOnce();
  });

  it("queries loans where user is either lender or borrower", async () => {
    loanFindManyMock.mockResolvedValueOnce([]);

    await getUserLoans("user-001");

    const call = loanFindManyMock.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(call.where).toMatchObject({
      OR: [{ lenderId: "user-001" }, { borrowerId: "user-001" }],
    });
  });

  it("only returns loans with active statuses (REQUESTED, OFFERED, ACTIVE)", async () => {
    loanFindManyMock.mockResolvedValueOnce([]);

    await getUserLoans("user-001");

    const call = loanFindManyMock.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(call.where).toMatchObject({
      status: { in: ["REQUESTED", "OFFERED", "ACTIVE"] },
    });
  });

  it("maps Prisma results to LoanView objects", async () => {
    const prismaLoan = makePrismaLoan();
    loanFindManyMock.mockResolvedValueOnce([prismaLoan]);

    const result = await getUserLoans("user-001");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "loan-001",
      bookId: "book-001",
      bookTitle: "Clean Code",
      lenderId: "user-lender",
      borrowerId: "user-borrower",
      status: "REQUESTED",
      createdAt: "2024-01-15T10:00:00.000Z",
    });
  });

  it("maps multiple loans to LoanView array", async () => {
    const loan1 = makePrismaLoan({ id: "loan-001" });
    const loan2 = makePrismaLoan({
      id: "loan-002",
      bookId: "book-002",
      status: "OFFERED",
      book: { title: "The Pragmatic Programmer", coverUrl: null, authors: ["Andy Hunt"] },
    });
    loanFindManyMock.mockResolvedValueOnce([loan1, loan2]);

    const result = await getUserLoans("user-001");

    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe("loan-001");
    expect(result[1]!.id).toBe("loan-002");
    expect(result[1]!.status).toBe("OFFERED");
  });

  it("orders results by updatedAt desc", async () => {
    loanFindManyMock.mockResolvedValueOnce([]);

    await getUserLoans("user-001");

    const call = loanFindManyMock.mock.calls[0]![0] as { orderBy: Record<string, unknown> };
    expect(call.orderBy).toEqual({ updatedAt: "desc" });
  });
});

// ─── getActiveLoanForBook ─────────────────────────────────────────────────────

describe("getActiveLoanForBook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no active loan exists for the book", async () => {
    loanFindFirstMock.mockResolvedValueOnce(null);

    const result = await getActiveLoanForBook("book-001", "user-001");

    expect(result).toBeNull();
    expect(loanFindFirstMock).toHaveBeenCalledOnce();
  });

  it("returns a LoanView when an active loan exists", async () => {
    const prismaLoan = makePrismaLoan({ status: "ACTIVE" });
    loanFindFirstMock.mockResolvedValueOnce(prismaLoan);

    const result = await getActiveLoanForBook("book-001", "user-lender");

    expect(result).not.toBeNull();
    expect(result!.id).toBe("loan-001");
    expect(result!.status).toBe("ACTIVE");
  });

  it("queries by bookId and filters active statuses", async () => {
    loanFindFirstMock.mockResolvedValueOnce(null);

    await getActiveLoanForBook("book-001", "user-001");

    const call = loanFindFirstMock.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(call.where).toMatchObject({
      bookId: "book-001",
      status: { in: ["REQUESTED", "OFFERED", "ACTIVE"] },
    });
  });

  it("queries only loans involving the given userId (as lender or borrower)", async () => {
    loanFindFirstMock.mockResolvedValueOnce(null);

    await getActiveLoanForBook("book-001", "user-001");

    const call = loanFindFirstMock.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(call.where).toMatchObject({
      OR: [{ lenderId: "user-001" }, { borrowerId: "user-001" }],
    });
  });

  it("maps the Prisma result to a LoanView when found", async () => {
    const prismaLoan = makePrismaLoan({
      id: "loan-active",
      status: "OFFERED",
      createdAt: new Date("2025-03-01T00:00:00.000Z"),
    });
    loanFindFirstMock.mockResolvedValueOnce(prismaLoan);

    const result = await getActiveLoanForBook("book-001", "user-lender");

    expect(result).toMatchObject({
      id: "loan-active",
      bookTitle: "Clean Code",
      status: "OFFERED",
      createdAt: "2025-03-01T00:00:00.000Z",
    });
  });
});
