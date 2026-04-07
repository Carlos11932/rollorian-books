import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";

const {
  acceptLoanMock,
  declineLoanMock,
  returnLoanMock,
  LoanNotFoundError,
  LoanForbiddenError,
  LoanInvalidTransitionError,
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
  return {
    acceptLoanMock: vi.fn(),
    declineLoanMock: vi.fn(),
    returnLoanMock: vi.fn(),
    LoanNotFoundError: _LoanNotFoundError,
    LoanForbiddenError: _LoanForbiddenError,
    LoanInvalidTransitionError: _LoanInvalidTransitionError,
  };
});

vi.mock("@/lib/loans", () => ({
  acceptLoan: (...args: unknown[]) => acceptLoanMock(...args),
  declineLoan: (...args: unknown[]) => declineLoanMock(...args),
  returnLoan: (...args: unknown[]) => returnLoanMock(...args),
  LoanNotFoundError,
  LoanForbiddenError,
  LoanInvalidTransitionError,
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

  it("returns 500 on unexpected errors", async () => {
    acceptLoanMock.mockRejectedValueOnce(new Error("DB connection lost"));

    const res = await PATCH(makePatchRequest({ action: "accept" }) as never, makeRouteContext());

    expect(res.status).toBe(500);
  });
});
