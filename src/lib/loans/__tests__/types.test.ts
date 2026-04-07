import { describe, it, expect } from "vitest";
import { toLoanView, LOAN_SELECT } from "../types";
import type { LoanView } from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePrismaLoan(overrides: Partial<Parameters<typeof toLoanView>[0]> = {}): Parameters<typeof toLoanView>[0] {
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

// ─── toLoanView ───────────────────────────────────────────────────────────────

describe("toLoanView", () => {
  it("maps all fields correctly from a full Prisma loan", () => {
    const prismaLoan = makePrismaLoan();
    const view = toLoanView(prismaLoan);

    expect(view).toEqual<LoanView>({
      id: "loan-001",
      bookId: "book-001",
      bookTitle: "Clean Code",
      bookCoverUrl: "https://example.com/cover.jpg",
      bookAuthors: ["Robert C. Martin"],
      lenderId: "user-lender",
      lenderName: "Alice",
      lenderImage: "https://example.com/alice.jpg",
      borrowerId: "user-borrower",
      borrowerName: "Bob",
      borrowerImage: null,
      status: "REQUESTED",
      createdAt: "2024-01-15T10:00:00.000Z",
    });
  });

  it("converts createdAt Date to ISO string", () => {
    const date = new Date("2025-06-20T08:30:00.000Z");
    const view = toLoanView(makePrismaLoan({ createdAt: date }));
    expect(view.createdAt).toBe("2025-06-20T08:30:00.000Z");
  });

  it("preserves null coverUrl", () => {
    const view = toLoanView(makePrismaLoan({ book: { title: "Test", coverUrl: null, authors: [] } }));
    expect(view.bookCoverUrl).toBeNull();
  });

  it("preserves null lenderImage", () => {
    const view = toLoanView(
      makePrismaLoan({ lender: { id: "u1", name: "Alice", image: null } }),
    );
    expect(view.lenderImage).toBeNull();
  });

  it("preserves null borrowerImage", () => {
    const view = toLoanView(
      makePrismaLoan({ borrower: { id: "u2", name: "Bob", image: null } }),
    );
    expect(view.borrowerImage).toBeNull();
  });

  it("preserves null lenderName", () => {
    const view = toLoanView(
      makePrismaLoan({ lender: { id: "u1", name: null, image: null } }),
    );
    expect(view.lenderName).toBeNull();
  });

  it("preserves null borrowerName", () => {
    const view = toLoanView(
      makePrismaLoan({ borrower: { id: "u2", name: null, image: null } }),
    );
    expect(view.borrowerName).toBeNull();
  });

  it("maps multiple authors correctly", () => {
    const view = toLoanView(
      makePrismaLoan({ book: { title: "Book", coverUrl: null, authors: ["Author A", "Author B", "Author C"] } }),
    );
    expect(view.bookAuthors).toEqual(["Author A", "Author B", "Author C"]);
  });

  it("maps status correctly for different loan states", () => {
    const statuses = ["REQUESTED", "OFFERED", "ACTIVE", "RETURNED", "DECLINED"];
    for (const status of statuses) {
      const view = toLoanView(makePrismaLoan({ status }));
      expect(view.status).toBe(status);
    }
  });

  it("maps lenderId and borrowerId from root fields (not from nested objects)", () => {
    const view = toLoanView(makePrismaLoan());
    expect(view.lenderId).toBe("user-lender");
    expect(view.borrowerId).toBe("user-borrower");
  });
});

// ─── LOAN_SELECT ──────────────────────────────────────────────────────────────

describe("LOAN_SELECT", () => {
  it("selects id, bookId, status, createdAt, lenderId, borrowerId", () => {
    expect(LOAN_SELECT.id).toBe(true);
    expect(LOAN_SELECT.bookId).toBe(true);
    expect(LOAN_SELECT.status).toBe(true);
    expect(LOAN_SELECT.createdAt).toBe(true);
    expect(LOAN_SELECT.lenderId).toBe(true);
    expect(LOAN_SELECT.borrowerId).toBe(true);
  });

  it("includes book sub-select with title, coverUrl, and authors", () => {
    expect(LOAN_SELECT.book.select.title).toBe(true);
    expect(LOAN_SELECT.book.select.coverUrl).toBe(true);
    expect(LOAN_SELECT.book.select.authors).toBe(true);
  });

  it("includes lender sub-select with id, name, and image", () => {
    expect(LOAN_SELECT.lender.select.id).toBe(true);
    expect(LOAN_SELECT.lender.select.name).toBe(true);
    expect(LOAN_SELECT.lender.select.image).toBe(true);
  });

  it("includes borrower sub-select with id, name, and image", () => {
    expect(LOAN_SELECT.borrower.select.id).toBe(true);
    expect(LOAN_SELECT.borrower.select.name).toBe(true);
    expect(LOAN_SELECT.borrower.select.image).toBe(true);
  });
});
