import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/loans", () => ({
  getUserLoans: vi.fn(),
  requestLoan: vi.fn(),
  offerLoan: vi.fn(),
  LoanInvalidTransitionError: class extends Error {
    constructor() { super("This book is already involved in an active loan"); }
  },
  LoanBookNotInLibraryError: class extends Error {
    constructor() { super("Book is not in the lender's library"); }
  },
  LoanBookNotOwnedError: class extends Error {
    constructor() { super("Lender does not own this book (ownershipStatus is not OWNED)"); }
  },
  LoanOwnershipVerificationUnavailableError: class extends Error {
    constructor() {
      super("Loan ownership and library verification are unavailable until the UserBook schema is updated");
    }
  },
  LoanWriteConflictError: class extends Error {
    constructor() {
      super("Could not create the loan because another loan update happened at the same time. Please retry.");
    }
  },
  LoanSelfBorrowError: class extends Error {
    constructor() { super("Cannot create a loan with yourself"); }
  },
}));

import { POST } from "../route";
import {
  requestLoan,
  offerLoan,
  LoanBookNotOwnedError,
  LoanOwnershipVerificationUnavailableError,
  LoanInvalidTransitionError,
  LoanWriteConflictError,
  LoanSelfBorrowError,
} from "@/lib/loans";

const mockRequestLoan = requestLoan as ReturnType<typeof vi.fn>;
const mockOfferLoan = offerLoan as ReturnType<typeof vi.fn>;

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeMalformedJsonRequest(): Request {
  return new Request("http://localhost/api/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
}

describe("POST /api/loans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when type is missing", async () => {
    const res = await POST(makeRequest({ targetUserId: "u2", bookId: "b1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when type is invalid", async () => {
    const res = await POST(makeRequest({ type: "borrow", targetUserId: "u2", bookId: "b1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when targetUserId is missing", async () => {
    const res = await POST(makeRequest({ type: "request", bookId: "b1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when bookId is missing", async () => {
    const res = await POST(makeRequest({ type: "offer", targetUserId: "u2" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the JSON body is malformed", async () => {
    const res = await POST(makeMalformedJsonRequest());

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid request" });
  });

  it("calls requestLoan for type 'request' and returns 201", async () => {
    const loanView = { id: "loan1", status: "REQUESTED" };
    mockRequestLoan.mockResolvedValue(loanView);

    const res = await POST(makeRequest({ type: "request", targetUserId: "u2", bookId: "b1" }));
    expect(res.status).toBe(201);
    expect(mockRequestLoan).toHaveBeenCalled();
  });

  it("calls offerLoan for type 'offer' and returns 201", async () => {
    const loanView = { id: "loan2", status: "OFFERED" };
    mockOfferLoan.mockResolvedValue(loanView);

    const res = await POST(makeRequest({ type: "offer", targetUserId: "u2", bookId: "b1" }));
    expect(res.status).toBe(201);
    expect(mockOfferLoan).toHaveBeenCalled();
  });

  it("returns generic error message on 500, not internal details", async () => {
    mockRequestLoan.mockRejectedValue(new Error("DB connection lost"));

    const res = await POST(makeRequest({ type: "request", targetUserId: "u2", bookId: "b1" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(body.error).not.toContain("DB connection");
  });

  it("returns 400 when lender does not own the book", async () => {
    mockRequestLoan.mockRejectedValue(new LoanBookNotOwnedError());

    const res = await POST(makeRequest({ type: "request", targetUserId: "u2", bookId: "b1" }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("ownershipStatus is not OWNED");
  });

  it("returns 503 when ownership verification is unavailable on the current schema", async () => {
    mockRequestLoan.mockRejectedValue(new LoanOwnershipVerificationUnavailableError());

    const res = await POST(makeRequest({ type: "request", targetUserId: "u2", bookId: "b1" }));

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain("ownership and library verification");
  });

  it("returns 400 when the book is already involved in another active loan", async () => {
    mockRequestLoan.mockRejectedValue(new LoanInvalidTransitionError("This book is already involved in an active loan"));

    const res = await POST(makeRequest({ type: "request", targetUserId: "u2", bookId: "b1" }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("already involved in an active loan");
  });

  it("returns 400 when the user tries to create a self-loan", async () => {
    mockRequestLoan.mockRejectedValue(new LoanSelfBorrowError());

    const res = await POST(makeRequest({ type: "request", targetUserId: "u2", bookId: "b1" }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Cannot create a loan with yourself");
  });

  it("returns 409 when loan creation exhausts write-conflict retries", async () => {
    mockRequestLoan.mockRejectedValue(new LoanWriteConflictError());

    const res = await POST(makeRequest({ type: "request", targetUserId: "u2", bookId: "b1" }));

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: "Could not create the loan because another loan update happened at the same time. Please retry.",
    });
  });
});
