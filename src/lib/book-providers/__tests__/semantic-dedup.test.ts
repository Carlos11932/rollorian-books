import { describe, it, expect } from "vitest";
import { semanticDedup, _coreTitle, _normalizeAuthor } from "../semantic-dedup";
import type { NormalizedBook } from "../types";

function makeBook(overrides: Partial<NormalizedBook> = {}): NormalizedBook {
  return {
    externalSource: "google_books",
    externalId: `id-${Math.random()}`,
    title: "Test Book",
    authors: ["Test Author"],
    publishedYear: 2023,
    isbn: null,
    coverUrl: null,
    ...overrides,
  };
}

describe("coreTitle", () => {
  it("strips subtitles after colon", () => {
    expect(_coreTitle("The Eye of the World: Book One")).toBe("the eye of the world");
  });

  it("strips parenthetical content", () => {
    expect(_coreTitle("The Eye of the World (Wheel of Time, #1)")).toBe("the eye of the world");
  });

  it("strips edition markers", () => {
    expect(_coreTitle("Clean Code — Special Edition")).toBe("clean code");
  });

  it("strips diacritics", () => {
    expect(_coreTitle("El señor de los anillos")).toBe("el senor de los anillos");
  });

  it("handles dash separators", () => {
    expect(_coreTitle("Dune - Hardcover Edition")).toBe("dune");
  });
});

describe("normalizeAuthor", () => {
  it("lowercases and strips diacritics", () => {
    expect(_normalizeAuthor("José Saramago")).toBe("jose saramago");
  });

  it("handles multiple spaces", () => {
    expect(_normalizeAuthor("Robert   Jordan")).toBe("robert jordan");
  });
});

describe("semanticDedup", () => {
  it("merges same title + same author with different ISBN/publisher", () => {
    const books = [
      makeBook({ title: "Clean Code", authors: ["Robert C. Martin"], isbn: "978-0132350884", coverUrl: "cover1.jpg", description: "A handbook" }),
      makeBook({ title: "Clean Code", authors: ["Robert C. Martin"], isbn: "978-0132350885", publisher: "Prentice Hall" }),
    ];
    const result = semanticDedup(books);
    expect(result).toHaveLength(1);
    expect(result[0]!.coverUrl).toBe("cover1.jpg");
    expect(result[0]!.publisher).toBe("Prentice Hall");
  });

  it("merges editions with subtitle differences", () => {
    const books = [
      makeBook({ title: "Dune", authors: ["Frank Herbert"], coverUrl: "cover.jpg" }),
      makeBook({ title: "Dune: Deluxe Edition", authors: ["Frank Herbert"], description: "The classic sci-fi novel" }),
    ];
    const result = semanticDedup(books);
    expect(result).toHaveLength(1);
    expect(result[0]!.description).toBe("The classic sci-fi novel");
  });

  it("does NOT merge different volumes in a series", () => {
    const books = [
      makeBook({ title: "The Eye of the World", authors: ["Robert Jordan"] }),
      makeBook({ title: "The Great Hunt", authors: ["Robert Jordan"] }),
    ];
    const result = semanticDedup(books);
    expect(result).toHaveLength(2);
  });

  it("does NOT merge books by different authors with similar titles", () => {
    const books = [
      makeBook({ title: "Foundations", authors: ["Isaac Asimov"] }),
      makeBook({ title: "Foundations", authors: ["Karl Popper"] }),
    ];
    const result = semanticDedup(books);
    expect(result).toHaveLength(2);
  });

  it("preserves best metadata when merging", () => {
    const books = [
      makeBook({ title: "1984", authors: ["George Orwell"], coverUrl: null, pageCount: 328 }),
      makeBook({ title: "1984", authors: ["George Orwell"], coverUrl: "cover.jpg", pageCount: undefined }),
    ];
    const result = semanticDedup(books);
    expect(result).toHaveLength(1);
    expect(result[0]!.coverUrl).toBe("cover.jpg");
    expect(result[0]!.pageCount).toBe(328);
  });

  it("handles empty input", () => {
    expect(semanticDedup([])).toHaveLength(0);
  });

  it("handles single book", () => {
    const books = [makeBook({ title: "Solo" })];
    expect(semanticDedup(books)).toHaveLength(1);
  });
});
