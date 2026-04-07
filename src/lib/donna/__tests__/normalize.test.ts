import { describe, expect, it } from "vitest";
import { normalizeTitle, normalizeBook, type BookInput } from "@/lib/donna/normalize";

// ---------------------------------------------------------------------------
// normalizeTitle
// ---------------------------------------------------------------------------

describe("normalizeTitle", () => {
  it("trims leading whitespace", () => {
    expect(normalizeTitle("  Dune")).toBe("dune");
  });

  it("trims trailing whitespace", () => {
    expect(normalizeTitle("Dune  ")).toBe("dune");
  });

  it("trims both sides", () => {
    expect(normalizeTitle("  Dune  ")).toBe("dune");
  });

  it("lowercases all characters", () => {
    expect(normalizeTitle("THE GREAT GATSBY")).toBe("the great gatsby");
  });

  it("lowercases mixed case", () => {
    expect(normalizeTitle("The Great Gatsby")).toBe("the great gatsby");
  });

  it("preserves already lowercase text unchanged", () => {
    expect(normalizeTitle("foundation")).toBe("foundation");
  });

  it("returns empty string when input is only whitespace", () => {
    expect(normalizeTitle("   ")).toBe("");
  });

  it("handles an empty string", () => {
    expect(normalizeTitle("")).toBe("");
  });

  it("handles internal whitespace (does not collapse it)", () => {
    // normalizeTitle only trims and lowercases — internal spaces are kept
    expect(normalizeTitle("  A Tale  Of  Two Cities  ")).toBe("a tale  of  two cities");
  });
});

// ---------------------------------------------------------------------------
// normalizeBook
// ---------------------------------------------------------------------------

function makeBookInput(overrides: Partial<BookInput> = {}): BookInput {
  return {
    id: "book-001",
    title: "Dune",
    subtitle: null,
    authors: ["Frank Herbert"],
    description: null,
    coverUrl: null,
    publisher: null,
    publishedDate: null,
    pageCount: null,
    isbn10: null,
    isbn13: null,
    genres: [],
    ...overrides,
  };
}

describe("normalizeBook", () => {
  it("preserves the id field", () => {
    const book = makeBookInput({ id: "abc-123" });
    expect(normalizeBook(book).id).toBe("abc-123");
  });

  it("preserves the title as-is (no normalisation on title field)", () => {
    const book = makeBookInput({ title: "Dune" });
    expect(normalizeBook(book).title).toBe("Dune");
  });

  it("coerces undefined subtitle to null", () => {
    const book = makeBookInput({ subtitle: undefined });
    expect(normalizeBook(book).subtitle).toBeNull();
  });

  it("preserves a non-null subtitle", () => {
    const book = makeBookInput({ subtitle: "The Beginning" });
    expect(normalizeBook(book).subtitle).toBe("The Beginning");
  });

  it("preserves the authors array", () => {
    const book = makeBookInput({ authors: ["Frank Herbert", "Brian Herbert"] });
    expect(normalizeBook(book).authors).toEqual(["Frank Herbert", "Brian Herbert"]);
  });

  it("coerces undefined description to null", () => {
    const book = makeBookInput({ description: undefined });
    expect(normalizeBook(book).description).toBeNull();
  });

  it("preserves a non-null description", () => {
    const book = makeBookInput({ description: "A sci-fi epic." });
    expect(normalizeBook(book).description).toBe("A sci-fi epic.");
  });

  it("coerces undefined coverUrl to null", () => {
    const book = makeBookInput({ coverUrl: undefined });
    expect(normalizeBook(book).coverUrl).toBeNull();
  });

  it("coerces undefined pageCount to null", () => {
    const book = makeBookInput({ pageCount: undefined });
    expect(normalizeBook(book).pageCount).toBeNull();
  });

  it("preserves a numeric pageCount", () => {
    const book = makeBookInput({ pageCount: 412 });
    expect(normalizeBook(book).pageCount).toBe(412);
  });

  it("coerces undefined isbn10 to null", () => {
    expect(normalizeBook(makeBookInput({ isbn10: undefined })).isbn10).toBeNull();
  });

  it("coerces undefined isbn13 to null", () => {
    expect(normalizeBook(makeBookInput({ isbn13: undefined })).isbn13).toBeNull();
  });

  it("preserves isbn10 when provided", () => {
    expect(normalizeBook(makeBookInput({ isbn10: "0441013597" })).isbn10).toBe("0441013597");
  });

  it("preserves isbn13 when provided", () => {
    expect(normalizeBook(makeBookInput({ isbn13: "9780441013593" })).isbn13).toBe("9780441013593");
  });

  it("preserves the genres array", () => {
    const book = makeBookInput({ genres: ["Science Fiction", "Epic"] });
    expect(normalizeBook(book).genres).toEqual(["Science Fiction", "Epic"]);
  });

  it("returns the correct shape with all required keys", () => {
    const result = normalizeBook(makeBookInput());
    const expectedKeys = [
      "id", "title", "subtitle", "authors", "description",
      "coverUrl", "publisher", "publishedDate", "pageCount", "isbn10", "isbn13", "genres",
    ];
    for (const key of expectedKeys) {
      expect(result).toHaveProperty(key);
    }
  });

  it("does not add extra keys beyond the schema", () => {
    const result = normalizeBook(makeBookInput());
    const expectedKeys = [
      "id", "title", "subtitle", "authors", "description",
      "coverUrl", "publisher", "publishedDate", "pageCount", "isbn10", "isbn13", "genres",
    ];
    expect(Object.keys(result).sort()).toEqual(expectedKeys.sort());
  });
});
