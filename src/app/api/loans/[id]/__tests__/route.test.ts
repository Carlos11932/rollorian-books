import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";

const {
  acceptLoanMock,
  declineLoanMock,
  returnLoanMock,
  LoanNotFoundError,
  LoanForbiddenError,
  LoanInvalidTransitionError,
  LoanBookNotInLibraryError,
  LoanBookNotOwnedError,
  LoanOwnershipVerificationUnavailableError,
  LoanWriteConflictError,
} = vi.hoisted(() => {
  class _LoanNotFoundError extends Error {
    constructor() { super("Loan not found"); }
  }
  class _LoanForbiddenError extends Error {
    constructor() { super("Not authorized for this loan"); }
  }
  class _LoanInvalidTransitionError extends Error {
    constructor(msg: string) { super(msg); }
  }
  class _LoanBookNotInLibraryError extends Error {
    constructor() { super("Book is not in the lender's library"); }
  }
  class _LoanBookNotOwnedError extends Error {
    constructor() { super("Lender does not own this book (ownershipStatus is not OWNED)"); }
  }
  class _LoanOwnershipVerificationUnavailableError extends Error {
    constructor() {
      super("Loans requiring ownership verification are unavailable until the database schema is updated");
    }
  }
  class _LoanWriteConflictError extends Error {
    constructor(action = "accept the loan") {
      super(`Could not ${action} because another loan update happened at the same time. Please retry.`);
    }
  }
  return {
    acceptLoanMock: vi.fn(),
    declineLoanMock: vi.fn(),
    returnLoanMock: vi.fn(),
    LoanNotFoundError: _LoanNotFoundError,
    LoanForbiddenError: _LoanForbiddenError,
    LoanInvalidTransitionError: _LoanInvalidTransitionError,
    LoanBookNotInLibraryError: _LoanBookNotInLibraryError,
    LoanBookNotOwnedError: _LoanBookNotOwnedError,
    LoanOwnershipVerificationUnavailableError: _LoanOwnershipVerificationUnavailableError,
    LoanWriteConflictError: _LoanWriteConflictError,
  };
});

vi.mock("@/lib/loans", () => ({
  acceptLoan: (...args: unknown[]) => acceptLoanMock(...args),
  declineLoan: (...args: unknown[]) => declineLoanMock(...args),
  returnLoan: (...args: unknown[]) => returnLoanMock(...args),
  LoanNotFoundError,
  LoanForbiddenError,
  LoanInvalidTransitionError,
  LoanBookNotInLibraryError,
  LoanBookNotOwnedError,
  LoanOwnershipVerificationUnavailableError,
  LoanWriteConflictError,
}));

import { PATCH } from "../route";

const requireAuthMock = vi.mocked(requireAuth);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLoanView(overrides: Record<string, unknown> = {}) {
  return {
    id: "loan-001",
    bookId: "book-001",
    bookTitle: "Clean Code",
    bookCoverUrl: null,
    bookAuthors: ["Robert C. Martin"],
    lenderId: "user-lender",
    lenderName: "Alice",
    lenderImage: null,
    borrowerId: "user-borrower",
    borrowerName: "Bob",
    borrowerImage: null,
    status: "ACTIVE",
    createdAt: "2024-01-15T10:00:00.000Z",
    ...overrides,
  };
}

function makePatchRequest(body: unknown, loanId = "loan-001"): Request {
  return new Request(`http://localhost/api/loans/${loanId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeRouteContext(id = "loan-001"): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

// ─── PATCH /api/loans/[id] ────────────────────────────────────────────────────

describe("PATCH /api/loans/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── accept ──────────────────────────────────────────────────────────────────

  it("returns 200 with updated loan when action is 'accept'", async () => {
    const loanView = makeLoanView({ status: "ACTIVE" });
    acceptLoanMock.mockResolvedValueOnce(loanView);

    const res = await PATCH(makePatchRequest({ action: "accept" }) as never, makeRouteContext());

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe("ACTIVE");
    expect(acceptLoanMock).toHaveBeenCalledWith("loan-001", "test-user-001");
  });

  // ── decline ─────────────────────────────────────────────────────────────────

  it("returns 200 with updated loan when action is 'decline'", async () => {
    const loanView = makeLoanView({ status: "DECLINED" });
    declineLoanMock.mockResolvedValueOnce(loanView);

    const res = await PATCH(makePatchRequest({ action: "decline" }) as never, makeRouteContext());

    expect(res.status).toBe(200);
    expect(declineLoanMock).toHaveBeenCalledWith("loan-001", "test-user-001");
  });

  // ── return ──────────────────────────────────────────────────────────────────

  it("returns 200 with updated loan when action is 'return'", async () => {
    const loanView = makeLoanView({ status: "RETURNED" });
    returnLoanMock.mockResolvedValueOnce(loanView);

    const res = await PATCH(makePatchRequest({ action: "return" }) as never, makeRouteContext());

    expect(res.status).toBe(200);
    expect(returnLoanMock).toHaveBeenCalledWith("loan-001", "test-user-001");
  });

  // ── validation ──────────────────────────────────────────────────────────────

  it("returns 400 when action is missing", async () => {
    const res = await PATCH(makePatchRequest({}) as never, makeRouteContext());
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Missing action");
  });

  it("returns 400 when body is null", async () => {
    const res = await PATCH(makePatchRequest(null) as never, makeRouteContext());

    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Missing action");
    expect(acceptLoanMock).not.toHaveBeenCalled();
  });

  it("returns 400 when body has the wrong shape", async () => {
    const res = await PATCH(makePatchRequest(["accept"]) as never, makeRouteContext());

    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Missing action");
    expect(acceptLoanMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the JSON body is malformed", async () => {
    const request = new Request("http://localhost/api/loans/loan-001", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{\"action\":",
    });

    const res = await PATCH(request as never, makeRouteContext());

    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Invalid request");
  });

  it("returns 400 when action is invalid", async () => {
    const res = await PATCH(makePatchRequest({ action: "borrow" }) as never, makeRouteContext());
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Invalid action");
  });

  // ── error cases ─────────────────────────────────────────────────────────────

  it("returns 401 when requireAuth throws UnauthorizedError", async () => {
    requireAuthMock.mockRejectedValueOnce(new UnauthorizedError());

    const res = await PATCH(makePatchRequest({ action: "accept" }) as never, makeRouteContext());

    expect(res.status).toBe(401);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Unauthorized");
    expect(acceptLoanMock).not.toHaveBeenCalled();
  });

  it("returns 404 when LoanNotFoundError is thrown", async () => {
    acceptLoanMock.mockRejectedValueOnce(new LoanNotFoundError());

    const res = await PATCH(makePatchRequest({ action: "accept" }) as never, makeRouteContext());

    expect(res.status).toBe(404);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Loan not found");
  });

  it("returns 403 when LoanForbiddenError is thrown", async () => {
    acceptLoanMock.mockRejectedValueOnce(new LoanForbiddenError());

    const res = await PATCH(makePatchRequest({ action: "accept" }) as never, makeRouteContext());

    expect(res.status).toBe(403);
  });

  it("returns 400 when LoanInvalidTransitionError is thrown", async () => {
    acceptLoanMock.mockRejectedValueOnce(new LoanInvalidTransitionError("Cannot accept RETURNED loan"));

    const res = await PATCH(makePatchRequest({ action: "accept" }) as never, makeRouteContext());

    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Cannot accept RETURNED loan");
  });

  it("returns 400 when LoanBookNotInLibraryError is thrown", async () => {
    acceptLoanMock.mockRejectedValueOnce(new LoanBookNotInLibraryError());

    const res = await PATCH(makePatchRequest({ action: "accept" }) as never, makeRouteContext());

    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Book is not in the lender's library");
  });

  it("returns 400 when LoanBookNotOwnedError is thrown", async () => {
    acceptLoanMock.mockRejectedValueOnce(new LoanBookNotOwnedError());

    const res = await PATCH(makePatchRequest({ action: "accept" }) as never, makeRouteContext());

    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Lender does not own this book (ownershipStatus is not OWNED)");
  });

  it("returns 503 when ownership verification is unavailable", async () => {
    acceptLoanMock.mockRejectedValueOnce(new LoanOwnershipVerificationUnavailableError());

    const res = await PATCH(makePatchRequest({ action: "accept" }) as never, makeRouteContext());

    expect(res.status).toBe(503);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Loans requiring ownership verification are unavailable until the database schema is updated");
  });

  it("returns 500 on unexpected errors", async () => {
    acceptLoanMock.mockRejectedValueOnce(new Error("DB connection lost"));

    const res = await PATCH(makePatchRequest({ action: "accept" }) as never, makeRouteContext());

    expect(res.status).toBe(500);
    const body = await res.json() as Record<string, string>;
    expect(body.error).toBe("Internal server error");
    expect(body.error).not.toContain("DB connection");
  });

  it("returns 409 when loan acceptance exhausts write-conflict retries", async () => {
    acceptLoanMock.mockRejectedValueOnce(new LoanWriteConflictError());

    const res = await PATCH(makePatchRequest({ action: "accept" }) as never, makeRouteContext());

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: "Could not accept the loan because another loan update happened at the same time. Please retry.",
    });
  });

  it("returns 409 when loan decline exhausts write-conflict retries", async () => {
    declineLoanMock.mockRejectedValueOnce(new LoanWriteConflictError("decline the loan"));

    const res = await PATCH(makePatchRequest({ action: "decline" }) as never, makeRouteContext());

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: "Could not decline the loan because another loan update happened at the same time. Please retry.",
    });
  });

  it("returns 409 when loan return exhausts write-conflict retries", async () => {
    returnLoanMock.mockRejectedValueOnce(new LoanWriteConflictError("return the loan"));

    const res = await PATCH(makePatchRequest({ action: "return" }) as never, makeRouteContext());

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: "Could not return the loan because another loan update happened at the same time. Please retry.",
    });
  });
});
