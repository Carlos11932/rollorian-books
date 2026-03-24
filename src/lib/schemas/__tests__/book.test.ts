import { describe, it, expect } from "vitest";
import { createBookSchema, updateBookSchema, searchQuerySchema } from "@/lib/schemas/book";
import { BookStatus } from "@/lib/types/book";

// ─── createBookSchema ────────────────────────────────────────────────────────

describe("createBookSchema", () => {
  const validInput = {
    title: "Clean Code",
    authors: ["Robert C. Martin"],
    status: BookStatus.WISHLIST,
  };

  it("accepts a minimal valid payload (only required fields)", () => {
    const result = createBookSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("accepts a fully populated valid payload", () => {
    const result = createBookSchema.safeParse({
      title: "Clean Code",
      subtitle: "A Handbook of Agile Software Craftsmanship",
      authors: ["Robert C. Martin"],
      description: "A guide to writing clean code.",
      coverUrl: "https://example.com/cover.jpg",
      publisher: "Prentice Hall",
      publishedDate: "2008-08-01",
      pageCount: 464,
      isbn10: "0132350882",
      isbn13: "9780132350884",
      status: BookStatus.READ,
      rating: 5,
      notes: "Must re-read",
      genres: ["Software Engineering"],
    });
    expect(result.success).toBe(true);
  });

  it("defaults status to WISHLIST when status is not provided", () => {
    const result = createBookSchema.safeParse({
      title: "Clean Code",
      authors: ["Robert C. Martin"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe(BookStatus.WISHLIST);
    }
  });

  it("defaults genres to [] when genres is not provided", () => {
    const result = createBookSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.genres).toEqual([]);
    }
  });

  it("rejects empty title", () => {
    const result = createBookSchema.safeParse({ ...validInput, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing title", () => {
    const { title: _title, ...rest } = validInput;
    const result = createBookSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects empty authors array", () => {
    const result = createBookSchema.safeParse({ ...validInput, authors: [] });
    expect(result.success).toBe(false);
  });

  it("rejects missing authors field", () => {
    const { authors: _authors, ...rest } = validInput;
    const result = createBookSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects invalid status value", () => {
    const result = createBookSchema.safeParse({ ...validInput, status: "ARCHIVED" });
    expect(result.success).toBe(false);
  });

  it("accepts all valid status values", () => {
    for (const status of Object.values(BookStatus)) {
      const result = createBookSchema.safeParse({ ...validInput, status });
      expect(result.success, `expected status '${status}' to be valid`).toBe(true);
    }
  });

  it("rejects rating of 0 (below minimum of 1)", () => {
    // NOTE: the minimum is 1, NOT 0. A rating of 0 is invalid.
    const result = createBookSchema.safeParse({ ...validInput, rating: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects rating of 6 (above maximum of 5)", () => {
    const result = createBookSchema.safeParse({ ...validInput, rating: 6 });
    expect(result.success).toBe(false);
  });

  it("accepts rating of 1 (boundary minimum)", () => {
    const result = createBookSchema.safeParse({ ...validInput, rating: 1 });
    expect(result.success).toBe(true);
  });

  it("accepts rating of 5 (boundary maximum)", () => {
    const result = createBookSchema.safeParse({ ...validInput, rating: 5 });
    expect(result.success).toBe(true);
  });

  it("rejects non-integer rating", () => {
    const result = createBookSchema.safeParse({ ...validInput, rating: 3.5 });
    expect(result.success).toBe(false);
  });

  it("accepts absent optional fields (subtitle, description, coverUrl, etc.)", () => {
    const result = createBookSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subtitle).toBeUndefined();
      expect(result.data.description).toBeUndefined();
      expect(result.data.coverUrl).toBeUndefined();
      expect(result.data.rating).toBeUndefined();
    }
  });

  it("strips unknown extra fields (Zod strips by default)", () => {
    const result = createBookSchema.safeParse({
      ...validInput,
      unknownField: "should be stripped",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("unknownField" in result.data).toBe(false);
    }
  });

  it("rejects negative pageCount", () => {
    const result = createBookSchema.safeParse({ ...validInput, pageCount: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects zero pageCount (must be positive)", () => {
    const result = createBookSchema.safeParse({ ...validInput, pageCount: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects coverUrl that is not a valid URL", () => {
    const result = createBookSchema.safeParse({ ...validInput, coverUrl: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("accepts coverUrl as a valid absolute URL", () => {
    const result = createBookSchema.safeParse({
      ...validInput,
      coverUrl: "https://books.google.com/books/content?id=123&printsec=frontcover",
    });
    expect(result.success).toBe(true);
  });

  it("accepts coverUrl as null (book without a cover)", () => {
    const result = createBookSchema.safeParse({ ...validInput, coverUrl: null });
    expect(result.success).toBe(true);
  });
});

// ─── updateBookSchema ────────────────────────────────────────────────────────

describe("updateBookSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    const result = updateBookSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a valid status update", () => {
    const result = updateBookSchema.safeParse({ status: BookStatus.READING });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status in update", () => {
    const result = updateBookSchema.safeParse({ status: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("accepts null rating (clearing the rating)", () => {
    const result = updateBookSchema.safeParse({ rating: null });
    expect(result.success).toBe(true);
  });

  it("accepts null notes (clearing the notes)", () => {
    const result = updateBookSchema.safeParse({ notes: null });
    expect(result.success).toBe(true);
  });

  it("rejects rating out of range (0) in update", () => {
    const result = updateBookSchema.safeParse({ rating: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects rating out of range (6) in update", () => {
    const result = updateBookSchema.safeParse({ rating: 6 });
    expect(result.success).toBe(false);
  });
});

// ─── searchQuerySchema ────────────────────────────────────────────────────────

describe("searchQuerySchema", () => {
  it("accepts a valid search query", () => {
    const result = searchQuerySchema.safeParse({ q: "clean code" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty query string", () => {
    const result = searchQuerySchema.safeParse({ q: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing q field", () => {
    const result = searchQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
