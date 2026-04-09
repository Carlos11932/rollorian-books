import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  LoanNotFoundError,
  LoanForbiddenError,
  LoanInvalidTransitionError,
  LoanBookNotInLibraryError,
  LoanBookNotOwnedError,
} from "../errors";

// ─── Mock prisma and revalidation BEFORE importing mutations ─────────────────

const {
  userBookFindUniqueMock,
  loanFindFirstMock,
  loanFindUniqueMock,
  loanCreateMock,
  loanUpdateMock,
  userBookUpsertMock,
  userBookFindUniqueInTxMock,
  userBookDeleteMock,
  transactionMock,
  revalidateBookCollectionPathsMock,
} = vi.hoisted(() => ({
  userBookFindUniqueMock: vi.fn(),
  loanFindFirstMock: vi.fn(),
  loanFindUniqueMock: vi.fn(),
  loanCreateMock: vi.fn(),
  loanUpdateMock: vi.fn(),
  userBookUpsertMock: vi.fn(),
  userBookFindUniqueInTxMock: vi.fn(),
  userBookDeleteMock: vi.fn(),
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
      update: loanUpdateMock,
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

// ─── requestLoan ──────────────────────────────────────────────────────────────

describe("requestLoan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("throws LoanBookNotOwnedError when lender's ownershipStatus is UNKNOWN", async () => {
    userBookFindUniqueMock.mockResolvedValueOnce({ id: "ub-001", ownershipStatus: "UNKNOWN" });

    await expect(requestLoan("user-borrower", "user-lender", "book-001")).rejects.toThrow(
      LoanBookNotOwnedError,
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
});

// ─── offerLoan ────────────────────────────────────────────────────────────────

describe("offerLoan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("throws LoanBookNotOwnedError when lender's ownershipStatus is UNKNOWN", async () => {
    userBookFindUniqueMock.mockResolvedValueOnce({ id: "ub-001", ownershipStatus: "UNKNOWN" });

    await expect(offerLoan("user-lender", "user-borrower", "book-001")).rejects.toThrow(
      LoanBookNotOwnedError,
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
});

// ─── acceptLoan ───────────────────────────────────────────────────────────────

describe("acceptLoan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("transitions REQUESTED → ACTIVE when lender accepts", async () => {
    const loan = makePrismaLoan({ status: "REQUESTED", lenderId: "user-lender" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    const activatedLoan = makePrismaLoan({ status: "ACTIVE" });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        loan: { update: vi.fn().mockResolvedValue(activatedLoan) },
        userBook: { upsert: userBookUpsertMock },
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

    const activatedLoan = makePrismaLoan({ status: "ACTIVE" });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        loan: { update: vi.fn().mockResolvedValue(activatedLoan) },
        userBook: { upsert: userBookUpsertMock },
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

    const activatedLoan = makePrismaLoan({ status: "ACTIVE", bookId: "book-xyz" });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        loan: { update: vi.fn().mockResolvedValue(activatedLoan) },
        userBook: { upsert: userBookUpsertMock },
      };
      return fn(tx);
    });

    await acceptLoan("loan-001", "user-lender");

    expect(revalidateBookCollectionPathsMock).toHaveBeenCalledWith("book-xyz");
  });

  it("sets ownershipStatus NOT_OWNED on create but preserves existing ownershipStatus on update", async () => {
    const loan = makePrismaLoan({ status: "REQUESTED", lenderId: "user-lender", borrowerId: "user-borrower" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    const activatedLoan = makePrismaLoan({ status: "ACTIVE" });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        loan: { update: vi.fn().mockResolvedValue(activatedLoan) },
        userBook: { upsert: userBookUpsertMock },
      };
      return fn(tx);
    });

    await acceptLoan("loan-001", "user-lender");

    expect(userBookUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ ownershipStatus: "NOT_OWNED" }),
        update: expect.objectContaining({ status: "READING" }),
      }),
    );
    // Ensure ownershipStatus is NOT clobbered on update
    expect(userBookUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.not.objectContaining({ ownershipStatus: expect.anything() }),
      }),
    );
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
    const declinedLoan = makePrismaLoan({ status: "DECLINED" });
    loanUpdateMock.mockResolvedValueOnce(declinedLoan);

    const result = await declineLoan("loan-001", "user-lender");

    expect(result.status).toBe("DECLINED");
    expect(loanUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "DECLINED" } }),
    );
  });

  it("transitions OFFERED → DECLINED on success", async () => {
    const loan = makePrismaLoan({ status: "OFFERED" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);
    const declinedLoan = makePrismaLoan({ status: "DECLINED" });
    loanUpdateMock.mockResolvedValueOnce(declinedLoan);

    const result = await declineLoan("loan-001", "user-borrower");

    expect(result.status).toBe("DECLINED");
  });

  it("throws LoanNotFoundError when loan does not exist", async () => {
    loanFindUniqueMock.mockResolvedValueOnce(null);

    await expect(declineLoan("nonexistent", "user-001")).rejects.toThrow(LoanNotFoundError);
    expect(loanUpdateMock).not.toHaveBeenCalled();
  });

  it("throws LoanForbiddenError when user is neither lender nor borrower", async () => {
    const loan = makePrismaLoan({ lenderId: "user-lender", borrowerId: "user-borrower" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    await expect(declineLoan("loan-001", "user-stranger")).rejects.toThrow(LoanForbiddenError);
    expect(loanUpdateMock).not.toHaveBeenCalled();
  });

  it("throws LoanInvalidTransitionError when loan is already ACTIVE", async () => {
    const loan = makePrismaLoan({ status: "ACTIVE" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    await expect(declineLoan("loan-001", "user-lender")).rejects.toThrow(LoanInvalidTransitionError);
    expect(loanUpdateMock).not.toHaveBeenCalled();
  });

  it("throws LoanInvalidTransitionError when loan is already RETURNED", async () => {
    const loan = makePrismaLoan({ status: "RETURNED" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    await expect(declineLoan("loan-001", "user-lender")).rejects.toThrow(LoanInvalidTransitionError);
  });

  it("allows the borrower to decline a REQUESTED loan (cancel)", async () => {
    const loan = makePrismaLoan({ status: "REQUESTED", lenderId: "user-lender", borrowerId: "user-borrower" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);
    const declinedLoan = makePrismaLoan({ status: "DECLINED" });
    loanUpdateMock.mockResolvedValueOnce(declinedLoan);

    const result = await declineLoan("loan-001", "user-borrower");
    expect(result.status).toBe("DECLINED");
  });

  it("returns a mapped LoanView", async () => {
    const loan = makePrismaLoan({ status: "REQUESTED" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);
    loanUpdateMock.mockResolvedValueOnce(makePrismaLoan({ status: "DECLINED" }));

    const result = await declineLoan("loan-001", "user-lender");

    expect(result).toMatchObject({
      id: "loan-001",
      bookTitle: "Clean Code",
      status: "DECLINED",
    });
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

    const returnedLoan = makePrismaLoan({ status: "RETURNED" });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        loan: { update: vi.fn().mockResolvedValue(returnedLoan) },
        userBook: {
          findUnique: userBookFindUniqueInTxMock.mockResolvedValueOnce(null),
          delete: userBookDeleteMock,
        },
      };
      return fn(tx);
    });

    const result = await returnLoan("loan-001", "user-lender");

    expect(result.status).toBe("RETURNED");
    expect(revalidateBookCollectionPathsMock).toHaveBeenCalledWith("book-001");
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

    const returnedLoan = makePrismaLoan({ status: "RETURNED" });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        loan: { update: vi.fn().mockResolvedValue(returnedLoan) },
        userBook: {
          findUnique: vi.fn().mockResolvedValue(null),
          delete: userBookDeleteMock,
        },
      };
      return fn(tx);
    });

    const result = await returnLoan("loan-001", "user-borrower");
    expect(result.status).toBe("RETURNED");
  });

  it("deletes borrower UserBook when ownershipStatus is NOT_OWNED and status is not READ", async () => {
    const loan = makePrismaLoan({ status: "ACTIVE", borrowerId: "user-borrower", bookId: "book-001" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    const returnedLoan = makePrismaLoan({ status: "RETURNED" });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        loan: { update: vi.fn().mockResolvedValue(returnedLoan) },
        userBook: {
          findUnique: vi.fn().mockResolvedValue({ id: "ub-borrower", status: "READING", ownershipStatus: "NOT_OWNED" }),
          delete: userBookDeleteMock,
        },
      };
      return fn(tx);
    });

    await returnLoan("loan-001", "user-lender");

    expect(userBookDeleteMock).toHaveBeenCalledWith({ where: { id: "ub-borrower" } });
  });

  it("does NOT delete borrower UserBook when ownershipStatus is OWNED (pre-existing entry)", async () => {
    const loan = makePrismaLoan({ status: "ACTIVE", borrowerId: "user-borrower", bookId: "book-001" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    const returnedLoan = makePrismaLoan({ status: "RETURNED" });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        loan: { update: vi.fn().mockResolvedValue(returnedLoan) },
        userBook: {
          findUnique: vi.fn().mockResolvedValue({ id: "ub-borrower", status: "READING", ownershipStatus: "OWNED" }),
          delete: userBookDeleteMock,
        },
      };
      return fn(tx);
    });

    await returnLoan("loan-001", "user-lender");

    expect(userBookDeleteMock).not.toHaveBeenCalled();
  });

  it("does NOT delete borrower UserBook when status is READ", async () => {
    const loan = makePrismaLoan({ status: "ACTIVE" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    const returnedLoan = makePrismaLoan({ status: "RETURNED" });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        loan: { update: vi.fn().mockResolvedValue(returnedLoan) },
        userBook: {
          findUnique: vi.fn().mockResolvedValue({ id: "ub-borrower", status: "READ" }),
          delete: userBookDeleteMock,
        },
      };
      return fn(tx);
    });

    await returnLoan("loan-001", "user-lender");

    expect(userBookDeleteMock).not.toHaveBeenCalled();
  });

  it("calls revalidateBookCollectionPaths with the bookId", async () => {
    const loan = makePrismaLoan({ status: "ACTIVE", bookId: "book-xyz" });
    loanFindUniqueMock.mockResolvedValueOnce(loan);

    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        loan: { update: vi.fn().mockResolvedValue(makePrismaLoan({ status: "RETURNED", bookId: "book-xyz" })) },
        userBook: {
          findUnique: vi.fn().mockResolvedValue(null),
          delete: userBookDeleteMock,
        },
      };
      return fn(tx);
    });

    await returnLoan("loan-001", "user-lender");

    expect(revalidateBookCollectionPathsMock).toHaveBeenCalledWith("book-xyz");
  });
});
