import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/loans", () => ({
  getUserLoans: vi.fn(),
  requestLoan: vi.fn(),
  offerLoan: vi.fn(),
  LoanBookNotInLibraryError: class extends Error {
    constructor() { super("Book is not in the lender's library"); }
  },
}));

import { POST } from "../route";
import { requestLoan, offerLoan } from "@/lib/loans";

const mockRequestLoan = requestLoan as ReturnType<typeof vi.fn>;
const mockOfferLoan = offerLoan as ReturnType<typeof vi.fn>;

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
});
