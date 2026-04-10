import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import {
  LoanNotFoundError,
  LoanForbiddenError,
  LoanInvalidTransitionError,
  LoanBookNotInLibraryError,
  LoanBookNotOwnedError,
  LoanOwnershipVerificationUnavailableError,
  LoanSelfBorrowError,
  LoanWriteConflictError,
} from "../errors";

// ─── Mock prisma and revalidation BEFORE importing mutations ─────────────────

const {
  userBookFindUniqueMock,
  loanFindFirstMock,
  loanFindUniqueMock,
  loanCreateMock,
  loanUpdateManyMock,
  userBookCreateMock,
  userBookUpdateMock,
  userBookFindUniqueInTxMock,
  userBookDeleteMock,
  userBookDeleteManyMock,
  transactionMock,
  revalidateBookCollectionPathsMock,
} = vi.hoisted(() => ({
  userBookFindUniqueMock: vi.fn(),
  loanFindFirstMock: vi.fn(),
  loanFindUniqueMock: vi.fn(),
  loanCreateMock: vi.fn(),
  loanUpdateManyMock: vi.fn(),
  userBookCreateMock: vi.fn(),
  userBookUpdateMock: vi.fn(),
  userBookFindUniqueInTxMock: vi.fn(),
  userBookDeleteMock: vi.fn(),
  userBookDeleteManyMock: vi.fn(),
  transactionMock: vi.fn(),
  revalidateBookCollectionPathsMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userBook: {
      findUnique: userBookFindUniqueMock,
    },
    loan: {
      findFirst: loanFindFirstMock,
      findUnique: loanFindUniqueMock,
      create: loanCreateMock,
      updateMany: loanUpdateManyMock,
    },
    $transaction: transactionMock,
  },
}));

vi.mock("@/lib/revalidation", () => ({
  revalidateBookCollectionPaths: revalidateBookCollectionPathsMock,
}));

import { requestLoan, offerLoan, acceptLoan, declineLoan, returnLoan } from "../mutations";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePrismaLoan(overrides: Record<string, unknown> = {}) {
  return {
    id: "loan-001",
    bookId: "book-001",
    status: "REQUESTED",
    createdAt: new Date("2024-01-15T10:00:00.000Z"),
    updatedAt: new Date("2024-01-15T10:00:00.000Z"),
    lenderId: "user-lender",
    borrowerId: "user-borrower",
    book: {
      title: "Clean Code",
      coverUrl: null,
      authors: ["Robert C. Martin"],
    },
    lender: {
      id: "user-lender",
      name: "Alice",
      image: null,
    },
    borrower: {
      id: "user-borrower",
      name: "Bob",
      image: null,
    },
    ...overrides,
  };
}

function makeOwnershipStatusCompatError(): Prisma.PrismaClientKnownRequestError {
  return Object.assign(
    Object.create(Prisma.PrismaClientKnownRequestError.prototype),
    {
      code: "P2022",
      message: "The column `ownershipStatus` does not exist in the current database.",
      clientVersion: "7.5.0",
      meta: {},
      name: "PrismaClientKnownRequestError",
    },
  ) as Prisma.PrismaClientKnownRequestError;
}

function makeWriteConflictError(): Prisma.PrismaClientKnownRequestError {
  return Object.assign(
    Object.create(Prisma.PrismaClientKnownRequestError.prototype),
    {
      code: "P2034",
      message: "Transaction failed due to a write conflict or a deadlock.",
      clientVersion: "7.5.0",
      meta: {},
      name: "PrismaClientKnownRequestError",
    },
  ) as Prisma.PrismaClientKnownRequestError;
}

// ─── requestLoan ──────────────────────────────────────────────────────────────

describe("requestLoan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      userBook: { findUnique: userBookFindUniqueMock },
      loan: {
        findFirst: loanFindFirstMock,
        create: loanCreateMock,
      },
    }));
  });

  it("creates a loan with REQUESTED status on success", async () => {
    userBookFindUniqueMock.mockResolvedValueOnce({ id: "ub-001", ownershipStatus: "OWNED" });
    loanFindFirstMock.mockResolvedValueOnce(null);
    const createdLoan = makePrismaLoan({ status: "REQUESTED" });
    loanCreateMock.mockResolvedValueOnce(createdLoan);

    const result = await requestLoan("user-borrower", "user-lender", "book-001");

    expect(loanCreateMock).toHaveBeenCalledOnce();
    expect(loanCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REQUESTED" }),
      }),
    );
    expect(result.status).toBe("REQUESTED");
    expect(result.id).toBe("loan-001");
  });

  it("throws LoanBookNotInLibraryError when lender does not own the book", async () => {
    userBookFindUniqueMock.mockResolvedValueOnce(null);

    await expect(requestLoan("user-borrower", "user-lender", "book-001")).rejects.toThrow(
      LoanBookNotInLibraryError,
    );
    expect(loanCreateMock).not.toHaveBeenCalled();
  });

  it("throws LoanBookNotOwnedError when lender's ownershipStatus is NOT_OWNED", async () => {
    userBookFindUniqueMock.mockResolvedValueOnce({ id: "ub-001", ownershipStatus: "NOT_OWNED" });

    await expect(requestLoan("user-borrower", "user-lender", "book-001")).rejects.toThrow(
      LoanBookNotOwnedError,
    );
    expect(loanCreateMock).not.toHaveBeenCalled();
  });

  it("throws LoanBookNotOwnedError when lender's stored ownershipStatus is UNKNOWN", async () => {
    userBookFindUniqueMock.mockResolvedValueOnce({ id: "ub-001", ownershipStatus: "UNKNOWN" });

    await expect(requestLoan("user-borrower", "user-lender", "book-001")).rejects.toThrow(
      LoanBookNotOwnedError,
    );
    expect(loanCreateMock).not.toHaveBeenCalled();
  });

  it("fails closed when legacy compatibility fallback cannot verify ownershipStatus", async () => {
    userBookFindUniqueMock
      .mockRejectedValueOnce(makeOwnershipStatusCompatError())
      .mockResolvedValueOnce({ id: "ub-001" });

    await expect(requestLoan("user-borrower", "user-lender", "book-001")).rejects.toThrow(
      LoanOwnershipVerificationUnavailableError,
    );
    expect(loanCreateMock).not.toHaveBeenCalled();
  });

  it("throws LoanInvalidTransitionError when an active loan already exists", async () => {
    userBookFindUniqueMock.mockResolvedValueOnce({ id: "ub-001", ownershipStatus: "OWNED" });
    loanFindFirstMock.mockResolvedValueOnce({ id: "loan-existing" });

    await expect(requestLoan("user-borrower", "user-lender", "book-001")).rejects.toThrow(
      LoanInvalidTransitionError,
    );
    expect(loanCreateMock).not.toHaveBeenCalled();
  });

  it("verifies lender ownership using lenderId and bookId", async () => {
    userBookFindUniqueMock.mockResolvedValueOnce({ id: "ub-001", ownershipStatus: "OWNED" });
    loanFindFirstMock.mockResolvedValueOnce(null);
    loanCreateMock.mockResolvedValueOnce(makePrismaLoan());

    await requestLoan("user-borrower", "user-lender", "book-001");

    expect(userBookFindUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_bookId: { userId: "user-lender", bookId: "book-001" } },
      }),
    );
  });

  it("checks for existing active loans per lender+book (exclusive across all borrowers)", async () => {
    userBookFindUniqueMock.mockResolvedValueOnce({ id: "ub-001", ownershipStatus: "OWNED" });
    loanFindFirstMock.mockResolvedValueOnce(null);
    loanCreateMock.mockResolvedValueOnce(makePrismaLoan());

    await requestLoan("user-borrower", "user-lender", "book-001");

    expect(loanFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lenderId: "user-lender",
          bookId: "book-001",
          status: { in: ["REQUESTED", "OFFERED", "ACTIVE"] },
        }),
      }),
    );
  });

  it("returns a mapped LoanView", async () => {
    userBookFindUniqueMock.mockResolvedValueOnce({ id: "ub-001", ownershipStatus: "OWNED" });
    loanFindFirstMock.mockResolvedValueOnce(null);
    loanCreateMock.mockResolvedValueOnce(makePrismaLoan());

    const result = await requestLoan("user-borrower", "user-lender", "book-001");

    expect(result).toMatchObject({
      id: "loan-001",
      bookTitle: "Clean Code",
      lenderId: "user-lender",
      borrowerId: "user-borrower",
    });
  });

  it("rejects self-loans", async () => {
    await expect(requestLoan("user-001", "user-001", "book-001")).rejects.toThrow(
      LoanSelfBorrowError,
    );

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("throws LoanWriteConflictError when serializable creation conflicts exhaust retries", async () => {
    transactionMock
      .mockRejectedValueOnce(makeWriteConflictError())
      .mockRejectedValueOnce(makeWriteConflictError())
      .mockRejectedValueOnce(makeWriteConflictError());
    loanFindFirstMock.mockResolvedValueOnce(null);

    await expect(requestLoan("user-borrower", "user-lender", "book-001")).rejects.toThrow(
      LoanWriteConflictError,
    );
    expect(transactionMock).toHaveBeenCalledTimes(3);
    expect(loanFindFirstMock).toHaveBeenCalledTimes(1);
    expect(loanCreateMock).not.toHaveBeenCalled();
  });
});

// ─── offerLoan ────────────────────────────────────────────────────────────────

describe("offerLoan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      userBook: { findUnique: userBookFindUniqueMock },
      loan: {
        findFirst: loanFindFirstMock,
        create: loanCreateMock,
      },
    }));
  });

  it("creates a loan with OFFERED status on success", async () => {
    userBookFindUniqueMock.mockResolvedValueOnce({ id: "ub-001", ownershipStatus: "OWNED" });
    loanFindFirstMock.mockResolvedValueOnce(null);
    const createdLoan = makePrismaLoan({ status: "OFFERED" });
    loanCreateMock.mockResolvedValueOnce(createdLoan);

    const result = await offerLoan("user-lender", "user-borrower", "book-001");

    expect(loanCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "OFFERED" }),
      }),
    );
    expect(result.status).toBe("OFFERED");
  });

  it("throws LoanBookNotInLibraryError when lender does not own the book", async () => {
    userBookFindUniqueMock.mockResolvedValueOnce(null);

    await expect(offerLoan("user-lender", "user-borrower", "book-001")).rejects.toThrow(
      LoanBookNotInLibraryError,
    );
    expect(loanCreateMock).not.toHaveBeenCalled();
  });

  it("throws LoanBookNotOwnedError when lender's ownershipStatus is NOT_OWNED", async () => {
    userBookFindUniqueMock.mockResolvedValueOnce({ id: "ub-001", ownershipStatus: "NOT_OWNED" });

    await expect(offerLoan("user-lender", "user-borrower", "book-001")).rejects.toThrow(
      LoanBookNotOwnedError,
    );
    expect(loanCreateMock).not.toHaveBeenCalled();
  });

  it("throws LoanBookNotOwnedError when lender's stored ownershipStatus is UNKNOWN", async () => {
    userBookFindUniqueMock.mockResolvedValueOnce({ id: "ub-001", ownershipStatus: "UNKNOWN" });

    await expect(offerLoan("user-lender", "user-borrower", "book-001")).rejects.toThrow(
      LoanBookNotOwnedError,
    );
    expect(loanCreateMock).not.toHaveBeenCalled();
  });

  it("fails closed when legacy compatibility fallback cannot verify ownershipStatus", async () => {
    userBookFindUniqueMock
      .mockRejectedValueOnce(makeOwnershipStatusCompatError())
      .mockResolvedValueOnce({ id: "ub-001" });

    await expect(offerLoan("user-lender", "user-borrower", "book-001")).rejects.toThrow(
      LoanOwnershipVerificationUnavailableError,
    );
    expect(loanCreateMock).not.toHaveBeenCalled();
  });

  it("throws LoanInvalidTransitionError when an active loan already exists", async () => {
    userBookFindUniqueMock.mockResolvedValueOnce({ id: "ub-001", ownershipStatus: "OWNED" });
    loanFindFirstMock.mockResolvedValueOnce({ id: "loan-existing" });

    await expect(offerLoan("user-lender", "user-borrower", "book-001")).rejects.toThrow(
      LoanInvalidTransitionError,
    );
    expect(loanCreateMock).not.toHaveBeenCalled();
  });

  it("returns a mapped LoanView with OFFERED status", async () => {
    userBookFindUniqueMock.mockResolvedValueOnce({ id: "ub-001", ownershipStatus: "OWNED" });
    loanFindFirstMock.mockResolvedValueOnce(null);
    loanCreateMock.mockResolvedValueOnce(makePrismaLoan({ status: "OFFERED" }));

    const result = await offerLoan("user-lender", "user-borrower", "book-001");

    expect(result.status).toBe("OFFERED");
    expect(result.lenderId).toBe("user-lender");
    expect(result.borrowerId).toBe("user-borrower");
  });

  it("rejects self-loans", async () => {
    await expect(offerLoan("user-001", "user-001", "book-001")).rejects.toThrow(
      LoanSelfBorrowError,
    );

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("throws LoanWriteConflictError when offer creation exhausts write-conflict retries", async () => {
    transactionMock
      .mockRejectedValueOnce(makeWriteConflictError())
      .mockRejectedValueOnce(makeWriteConflictError())
      .mockRejectedValueOnce(makeWriteConflictError());
    loanFindFirstMock.mockResolvedValueOnce(null);

    await expect(offerLoan("user-lender", "user-borrower", "book-001")).rejects.toThrow(
      LoanWriteConflictError,
    );
    expect(transactionMock).toHaveBeenCalledTimes(3);
    expect(loanFindFirstMock).toHaveBeenCalledTimes(1);
    expect(loanCreateMock).not.toHaveBeenCalled();
  });
});

// ─── acceptLoan ───────────────────────────────────────────────────────────────

describe("acceptLoan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("transitions REQUESTED → ACTIVE when lender accepts", async () => {
    const loan = makePrismaLoan({ status: "REQUESTED", lenderId: "user-lender" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    loanUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>, options?: unknown) => {
      expect(options).toEqual({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      const tx = {
        loan: { updateMany: loanUpdateManyMock },
        userBook: {
          findUnique: userBookFindUniqueInTxMock.mockResolvedValueOnce({ id: "ub-lender", ownershipStatus: "OWNED" }),
        },
      };
      return fn(tx);
    });

    const result = await acceptLoan("loan-001", "user-lender");

    expect(result.status).toBe("ACTIVE");
    expect(revalidateBookCollectionPathsMock).toHaveBeenCalledWith("book-001");
  });

  it("transitions OFFERED → ACTIVE when borrower accepts", async () => {
    const loan = makePrismaLoan({ status: "OFFERED", borrowerId: "user-borrower" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    loanUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        loan: { updateMany: loanUpdateManyMock },
        userBook: {
          findUnique: userBookFindUniqueInTxMock.mockResolvedValueOnce({ id: "ub-lender", ownershipStatus: "OWNED" }),
        },
      };
      return fn(tx);
    });

    const result = await acceptLoan("loan-001", "user-borrower");

    expect(result.status).toBe("ACTIVE");
  });

  it("throws LoanNotFoundError when loan does not exist", async () => {
    loanFindUniqueMock.mockResolvedValueOnce(null);

    await expect(acceptLoan("nonexistent-loan", "user-001")).rejects.toThrow(LoanNotFoundError);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("throws LoanForbiddenError when wrong user tries to accept REQUESTED loan", async () => {
    // REQUESTED means lender must accept — but borrower trying
    const loan = makePrismaLoan({ status: "REQUESTED", lenderId: "user-lender", borrowerId: "user-borrower" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    await expect(acceptLoan("loan-001", "user-borrower")).rejects.toThrow(LoanForbiddenError);
  });

  it("throws LoanForbiddenError when wrong user tries to accept OFFERED loan", async () => {
    // OFFERED means borrower must accept — but lender trying
    const loan = makePrismaLoan({ status: "OFFERED", lenderId: "user-lender", borrowerId: "user-borrower" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    await expect(acceptLoan("loan-001", "user-lender")).rejects.toThrow(LoanForbiddenError);
  });

  it("throws LoanInvalidTransitionError when loan status is not REQUESTED or OFFERED", async () => {
    const loan = makePrismaLoan({ status: "ACTIVE" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    await expect(acceptLoan("loan-001", "user-lender")).rejects.toThrow(LoanInvalidTransitionError);
  });

  it("calls revalidateBookCollectionPaths with the bookId", async () => {
    const loan = makePrismaLoan({ status: "REQUESTED", lenderId: "user-lender", bookId: "book-xyz" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    loanUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        loan: { updateMany: loanUpdateManyMock },
        userBook: {
          findUnique: userBookFindUniqueInTxMock.mockResolvedValueOnce({ id: "ub-lender", ownershipStatus: "OWNED" }),
        },
      };
      return fn(tx);
    });

    await acceptLoan("loan-001", "user-lender");

    expect(revalidateBookCollectionPathsMock).toHaveBeenCalledWith("book-xyz");
  });

  it("does not create borrower tracking rows during activation", async () => {
    const loan = makePrismaLoan({ status: "REQUESTED", lenderId: "user-lender", borrowerId: "user-borrower" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    loanUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        loan: { updateMany: loanUpdateManyMock },
        userBook: {
          findUnique: userBookFindUniqueInTxMock.mockResolvedValueOnce({ id: "ub-lender", ownershipStatus: "OWNED" }),
        },
      };
      return fn(tx);
    });

    await acceptLoan("loan-001", "user-lender");

    expect(userBookFindUniqueInTxMock).toHaveBeenCalledTimes(1);
    expect(userBookUpdateMock).not.toHaveBeenCalled();
    expect(userBookCreateMock).not.toHaveBeenCalled();
  });

  it("fails closed when activation cannot verify lender ownership on a lagging schema", async () => {
    const loan = makePrismaLoan({ status: "REQUESTED", lenderId: "user-lender", borrowerId: "user-borrower" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        loan: { updateMany: loanUpdateManyMock },
        userBook: {
          findUnique: userBookFindUniqueInTxMock
            .mockRejectedValueOnce(makeOwnershipStatusCompatError())
            .mockResolvedValueOnce({ id: "ub-lender" }),
        },
      };
      return fn(tx);
    });

    await expect(acceptLoan("loan-001", "user-lender")).rejects.toThrow(
      LoanOwnershipVerificationUnavailableError,
    );
    expect(loanUpdateManyMock).not.toHaveBeenCalled();
    expect(userBookCreateMock).not.toHaveBeenCalled();
  });

  it("throws when the loan status changed before activation could be written", async () => {
    const loan = makePrismaLoan({ status: "REQUESTED", lenderId: "user-lender" });
    loanFindUniqueMock
      .mockResolvedValueOnce(loan)
      .mockResolvedValueOnce({ status: "DECLINED" });

    loanUpdateManyMock.mockResolvedValueOnce({ count: 0 });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      loan: { updateMany: loanUpdateManyMock },
      userBook: {
        findUnique: userBookFindUniqueInTxMock.mockResolvedValueOnce({ id: "ub-lender", ownershipStatus: "OWNED" }),
      },
    }));

    await expect(acceptLoan("loan-001", "user-lender")).rejects.toThrow(
      "Cannot accept a loan with status DECLINED",
    );
    expect(userBookCreateMock).not.toHaveBeenCalled();
  });

  it("re-checks lender ownership before activation", async () => {
    const loan = makePrismaLoan({ status: "REQUESTED", lenderId: "user-lender" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      loan: { updateMany: loanUpdateManyMock },
      userBook: {
        findUnique: userBookFindUniqueInTxMock.mockResolvedValueOnce({ id: "ub-lender", ownershipStatus: "NOT_OWNED" }),
      },
    }));

    await expect(acceptLoan("loan-001", "user-lender")).rejects.toThrow(LoanBookNotOwnedError);
    expect(loanUpdateManyMock).not.toHaveBeenCalled();
    expect(userBookCreateMock).not.toHaveBeenCalled();
  });

  it("retries activation when serializable transaction hits a write conflict", async () => {
    const loan = makePrismaLoan({ status: "REQUESTED", lenderId: "user-lender" });
    loanFindUniqueMock.mockResolvedValueOnce(loan).mockResolvedValueOnce(loan);
    loanUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    transactionMock
      .mockRejectedValueOnce(makeWriteConflictError())
      .mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => fn({
        loan: { updateMany: loanUpdateManyMock },
        userBook: {
          findUnique: userBookFindUniqueInTxMock.mockResolvedValueOnce({ id: "ub-lender", ownershipStatus: "OWNED" }),
        },
      }));

    const result = await acceptLoan("loan-001", "user-lender");

    expect(result.status).toBe("ACTIVE");
    expect(transactionMock).toHaveBeenCalledTimes(2);
    expect(loanFindUniqueMock).toHaveBeenCalledTimes(2);
  });

  it("throws LoanWriteConflictError when activation conflicts exhaust retries", async () => {
    const loan = makePrismaLoan({ status: "REQUESTED", lenderId: "user-lender" });
    loanFindUniqueMock
      .mockResolvedValueOnce(loan)
      .mockResolvedValueOnce(loan)
      .mockResolvedValueOnce(loan)
      .mockResolvedValueOnce({ status: "REQUESTED" });
    transactionMock
      .mockRejectedValueOnce(makeWriteConflictError())
      .mockRejectedValueOnce(makeWriteConflictError())
      .mockRejectedValueOnce(makeWriteConflictError());

    await expect(acceptLoan("loan-001", "user-lender")).rejects.toThrow(LoanWriteConflictError);
    expect(transactionMock).toHaveBeenCalledTimes(3);
    expect(loanFindUniqueMock).toHaveBeenCalledTimes(4);
    expect(loanUpdateManyMock).not.toHaveBeenCalled();
  });
});

// ─── declineLoan ─────────────────────────────────────────────────────────────

describe("declineLoan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("transitions REQUESTED → DECLINED on success", async () => {
    const loan = makePrismaLoan({ status: "REQUESTED" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);
    loanUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>, options?: unknown) => {
      expect(options).toEqual({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return fn({
        loan: { updateMany: loanUpdateManyMock },
      });
    });

    const result = await declineLoan("loan-001", "user-lender");

    expect(result.status).toBe("DECLINED");
    expect(loanUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "DECLINED" } }),
    );
  });

  it("transitions OFFERED → DECLINED on success", async () => {
    const loan = makePrismaLoan({ status: "OFFERED" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);
    loanUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>, options?: unknown) => {
      expect(options).toEqual({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return fn({
        loan: { updateMany: loanUpdateManyMock },
      });
    });

    const result = await declineLoan("loan-001", "user-borrower");

    expect(result.status).toBe("DECLINED");
  });

  it("throws LoanNotFoundError when loan does not exist", async () => {
    loanFindUniqueMock.mockResolvedValueOnce(null);

    await expect(declineLoan("nonexistent", "user-001")).rejects.toThrow(LoanNotFoundError);
    expect(loanUpdateManyMock).not.toHaveBeenCalled();
  });

  it("throws LoanForbiddenError when user is neither lender nor borrower", async () => {
    const loan = makePrismaLoan({ lenderId: "user-lender", borrowerId: "user-borrower" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    await expect(declineLoan("loan-001", "user-stranger")).rejects.toThrow(LoanForbiddenError);
    expect(loanUpdateManyMock).not.toHaveBeenCalled();
  });

  it("throws LoanInvalidTransitionError when loan is already ACTIVE", async () => {
    const loan = makePrismaLoan({ status: "ACTIVE" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    await expect(declineLoan("loan-001", "user-lender")).rejects.toThrow(LoanInvalidTransitionError);
    expect(loanUpdateManyMock).not.toHaveBeenCalled();
  });

  it("throws LoanInvalidTransitionError when loan is already RETURNED", async () => {
    const loan = makePrismaLoan({ status: "RETURNED" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    await expect(declineLoan("loan-001", "user-lender")).rejects.toThrow(LoanInvalidTransitionError);
  });

  it("allows the borrower to decline a REQUESTED loan (cancel)", async () => {
    const loan = makePrismaLoan({ status: "REQUESTED", lenderId: "user-lender", borrowerId: "user-borrower" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);
    loanUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      loan: { updateMany: loanUpdateManyMock },
    }));

    const result = await declineLoan("loan-001", "user-borrower");
    expect(result.status).toBe("DECLINED");
  });

  it("returns a mapped LoanView", async () => {
    const loan = makePrismaLoan({ status: "REQUESTED" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);
    loanUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      loan: { updateMany: loanUpdateManyMock },
    }));

    const result = await declineLoan("loan-001", "user-lender");

    expect(result).toMatchObject({
      id: "loan-001",
      bookTitle: "Clean Code",
      status: "DECLINED",
    });
  });

  it("retries decline when serializable transaction hits a write conflict", async () => {
    const loan = makePrismaLoan({ status: "REQUESTED" });
    loanFindUniqueMock.mockResolvedValueOnce(loan).mockResolvedValueOnce(loan);
    loanUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    transactionMock
      .mockRejectedValueOnce(makeWriteConflictError())
      .mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>, options?: unknown) => {
        expect(options).toEqual({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        return fn({
          loan: { updateMany: loanUpdateManyMock },
        });
      });

    const result = await declineLoan("loan-001", "user-lender");

    expect(result.status).toBe("DECLINED");
    expect(transactionMock).toHaveBeenCalledTimes(2);
    expect(loanFindUniqueMock).toHaveBeenCalledTimes(2);
  });

  it("throws LoanWriteConflictError when decline conflicts exhaust retries", async () => {
    const loan = makePrismaLoan({ status: "REQUESTED" });
    loanFindUniqueMock
      .mockResolvedValueOnce(loan)
      .mockResolvedValueOnce(loan)
      .mockResolvedValueOnce(loan)
      .mockResolvedValueOnce({ status: "REQUESTED" });
    transactionMock
      .mockRejectedValueOnce(makeWriteConflictError())
      .mockRejectedValueOnce(makeWriteConflictError())
      .mockRejectedValueOnce(makeWriteConflictError());

    await expect(declineLoan("loan-001", "user-lender")).rejects.toThrow(LoanWriteConflictError);
    expect(transactionMock).toHaveBeenCalledTimes(3);
    expect(loanFindUniqueMock).toHaveBeenCalledTimes(4);
    expect(loanUpdateManyMock).not.toHaveBeenCalled();
  });
});

// ─── returnLoan ───────────────────────────────────────────────────────────────

describe("returnLoan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("transitions ACTIVE → RETURNED on success", async () => {
    const loan = makePrismaLoan({ status: "ACTIVE" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    loanUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>, options?: unknown) => {
      expect(options).toEqual({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      const tx = {
        loan: { updateMany: loanUpdateManyMock },
        userBook: {
          findUnique: userBookFindUniqueInTxMock.mockResolvedValueOnce(null),
          delete: userBookDeleteMock,
          deleteMany: userBookDeleteManyMock,
        },
      };
      return fn(tx);
    });

    const result = await returnLoan("loan-001", "user-lender");

    expect(result.status).toBe("RETURNED");
    expect(revalidateBookCollectionPathsMock).toHaveBeenCalledWith("book-001");
  });

  it("retries return when serializable transaction hits a write conflict", async () => {
    const loan = makePrismaLoan({ status: "ACTIVE" });
    loanFindUniqueMock.mockResolvedValueOnce(loan).mockResolvedValueOnce(loan);
    loanUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    transactionMock
      .mockRejectedValueOnce(makeWriteConflictError())
      .mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>, options?: unknown) => {
        expect(options).toEqual({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        const tx = {
          loan: { updateMany: loanUpdateManyMock },
        };
        return fn(tx);
      });

    const result = await returnLoan("loan-001", "user-lender");

    expect(result.status).toBe("RETURNED");
    expect(transactionMock).toHaveBeenCalledTimes(2);
    expect(loanFindUniqueMock).toHaveBeenCalledTimes(2);
  });

  it("throws LoanWriteConflictError when return conflicts exhaust retries", async () => {
    const loan = makePrismaLoan({ status: "ACTIVE" });
    loanFindUniqueMock
      .mockResolvedValueOnce(loan)
      .mockResolvedValueOnce(loan)
      .mockResolvedValueOnce(loan)
      .mockResolvedValueOnce({ status: "ACTIVE" });
    transactionMock
      .mockRejectedValueOnce(makeWriteConflictError())
      .mockRejectedValueOnce(makeWriteConflictError())
      .mockRejectedValueOnce(makeWriteConflictError());

    await expect(returnLoan("loan-001", "user-lender")).rejects.toThrow(LoanWriteConflictError);
    expect(transactionMock).toHaveBeenCalledTimes(3);
    expect(loanFindUniqueMock).toHaveBeenCalledTimes(4);
    expect(loanUpdateManyMock).not.toHaveBeenCalled();
  });

  it("throws LoanNotFoundError when loan does not exist", async () => {
    loanFindUniqueMock.mockResolvedValueOnce(null);

    await expect(returnLoan("nonexistent", "user-001")).rejects.toThrow(LoanNotFoundError);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("throws LoanForbiddenError when user is neither lender nor borrower", async () => {
    const loan = makePrismaLoan({ lenderId: "user-lender", borrowerId: "user-borrower" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    await expect(returnLoan("loan-001", "user-stranger")).rejects.toThrow(LoanForbiddenError);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("throws LoanInvalidTransitionError when loan is not ACTIVE", async () => {
    const loan = makePrismaLoan({ status: "REQUESTED" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    await expect(returnLoan("loan-001", "user-lender")).rejects.toThrow(LoanInvalidTransitionError);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("throws LoanInvalidTransitionError when loan is already RETURNED", async () => {
    const loan = makePrismaLoan({ status: "RETURNED" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    await expect(returnLoan("loan-001", "user-lender")).rejects.toThrow(LoanInvalidTransitionError);
  });

  it("allows the borrower to mark loan as returned", async () => {
    const loan = makePrismaLoan({ status: "ACTIVE", lenderId: "user-lender", borrowerId: "user-borrower" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    loanUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        loan: { updateMany: loanUpdateManyMock },
        userBook: {
          findUnique: vi.fn().mockResolvedValue(null),
          delete: userBookDeleteMock,
          deleteMany: userBookDeleteManyMock,
        },
      };
      return fn(tx);
    });

    const result = await returnLoan("loan-001", "user-borrower");
    expect(result.status).toBe("RETURNED");
  });

  it("does not delete borrower rows even when they match the former synthetic shape", async () => {
    const activatedAt = new Date("2024-01-15T11:00:00.000Z");
    const loan = makePrismaLoan({ status: "ACTIVE", borrowerId: "user-borrower", bookId: "book-001", updatedAt: activatedAt });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    loanUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        loan: { updateMany: loanUpdateManyMock },
        userBook: {
          findUnique: vi.fn().mockResolvedValue({
            id: "ub-borrower",
            status: "READING",
            ownershipStatus: "NOT_OWNED",
            rating: null,
            notes: "",
            updatedAt: new Date("2024-01-15T11:00:01.000Z"),
          }),
          delete: userBookDeleteMock,
          deleteMany: userBookDeleteManyMock,
        },
      };
      return fn(tx);
    });

    await returnLoan("loan-001", "user-lender");

    expect(userBookDeleteManyMock).not.toHaveBeenCalled();
  });

  it("does NOT delete borrower UserBook when ownershipStatus is OWNED (pre-existing entry)", async () => {
    const activatedAt = new Date("2024-01-15T11:00:00.000Z");
    const loan = makePrismaLoan({ status: "ACTIVE", borrowerId: "user-borrower", bookId: "book-001", updatedAt: activatedAt });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    loanUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        loan: { updateMany: loanUpdateManyMock },
        userBook: {
          findUnique: vi.fn().mockResolvedValue({
            id: "ub-borrower",
            status: "READING",
            ownershipStatus: "OWNED",
            rating: null,
            notes: "",
            updatedAt: activatedAt,
          }),
          delete: userBookDeleteMock,
          deleteMany: userBookDeleteManyMock,
        },
      };
      return fn(tx);
    });

    await returnLoan("loan-001", "user-lender");

    expect(userBookDeleteManyMock).not.toHaveBeenCalled();
  });

  it("does NOT delete borrower UserBook when it has a rating or notes", async () => {
    const activatedAt = new Date("2024-01-15T11:00:00.000Z");
    const loan = makePrismaLoan({ status: "ACTIVE", borrowerId: "user-borrower", bookId: "book-001", updatedAt: activatedAt });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    loanUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        loan: { updateMany: loanUpdateManyMock },
        userBook: {
          findUnique: vi.fn().mockResolvedValue({
            id: "ub-borrower",
            status: "READING",
            ownershipStatus: "NOT_OWNED",
            rating: 5,
            notes: "Great loan",
            updatedAt: activatedAt,
          }),
          delete: userBookDeleteMock,
          deleteMany: userBookDeleteManyMock,
        },
      };
      return fn(tx);
    });

    await returnLoan("loan-001", "user-lender");

    expect(userBookDeleteManyMock).not.toHaveBeenCalled();
  });

  it("does NOT delete borrower UserBook when status is READ", async () => {
    const activatedAt = new Date("2024-01-15T11:00:00.000Z");
    const loan = makePrismaLoan({ status: "ACTIVE", updatedAt: activatedAt });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    loanUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        loan: { updateMany: loanUpdateManyMock },
        userBook: {
          findUnique: vi.fn().mockResolvedValue({
            id: "ub-borrower",
            status: "READ",
            ownershipStatus: "NOT_OWNED",
            rating: null,
            notes: "",
            updatedAt: activatedAt,
          }),
          delete: userBookDeleteMock,
          deleteMany: userBookDeleteManyMock,
        },
      };
      return fn(tx);
    });

    await returnLoan("loan-001", "user-lender");

    expect(userBookDeleteManyMock).not.toHaveBeenCalled();
  });

  it("does NOT delete borrower rows that do not carry the loan marker", async () => {
    const activatedAt = new Date("2024-01-15T11:00:00.000Z");
    const loan = makePrismaLoan({ status: "ACTIVE", updatedAt: activatedAt });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    loanUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        loan: { updateMany: loanUpdateManyMock },
        userBook: {
          findUnique: vi.fn().mockResolvedValue({
            id: "ub-borrower",
            status: "READING",
            ownershipStatus: "NOT_OWNED",
            rating: null,
            notes: null,
            updatedAt: new Date("2024-01-15T10:30:00.000Z"),
          }),
          delete: userBookDeleteMock,
          deleteMany: userBookDeleteManyMock,
        },
      };
      return fn(tx);
    });

    await returnLoan("loan-001", "user-lender");

    expect(userBookDeleteManyMock).not.toHaveBeenCalled();
  });

  it("does not delete borrower rows when ownershipStatus fallback returns UNKNOWN", async () => {
    const activatedAt = new Date("2024-01-15T11:00:00.000Z");
    const loan = makePrismaLoan({ status: "ACTIVE", borrowerId: "user-borrower", bookId: "book-001", updatedAt: activatedAt });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    loanUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        loan: { updateMany: loanUpdateManyMock },
        userBook: {
          findUnique: vi.fn().mockResolvedValue({
            id: "ub-borrower",
            status: "READING",
            ownershipStatus: "UNKNOWN",
            rating: null,
            notes: "",
            updatedAt: activatedAt,
          }),
          delete: userBookDeleteMock,
          deleteMany: userBookDeleteManyMock,
        },
      };
      return fn(tx);
    });

    await returnLoan("loan-001", "user-lender");

    expect(userBookDeleteManyMock).not.toHaveBeenCalled();
  });

  it("does not attempt borrower row cleanup during return", async () => {
    const activatedAt = new Date("2024-01-15T11:00:00.000Z");
    const loan = makePrismaLoan({ status: "ACTIVE", borrowerId: "user-borrower", bookId: "book-001", updatedAt: activatedAt });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    loanUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        loan: { updateMany: loanUpdateManyMock },
        userBook: {
          findUnique: vi.fn().mockResolvedValue({
            id: "ub-borrower",
            status: "READING",
            ownershipStatus: "NOT_OWNED",
            rating: null,
            notes: "",
            updatedAt: activatedAt,
          }),
          delete: userBookDeleteMock,
          deleteMany: userBookDeleteManyMock,
        },
      };
      return fn(tx);
    });

    await returnLoan("loan-001", "user-lender");

    expect(userBookDeleteManyMock).not.toHaveBeenCalled();
  });

  it("calls revalidateBookCollectionPaths with the bookId", async () => {
    const loan = makePrismaLoan({ status: "ACTIVE", bookId: "book-xyz" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    loanUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        loan: { updateMany: loanUpdateManyMock },
        userBook: {
          findUnique: vi.fn().mockResolvedValue(null),
          delete: userBookDeleteMock,
          deleteMany: userBookDeleteManyMock,
        },
      };
      return fn(tx);
    });

    await returnLoan("loan-001", "user-lender");

    expect(revalidateBookCollectionPathsMock).toHaveBeenCalledWith("book-xyz");
  });
});
