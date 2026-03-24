import { describe, it, expect } from "vitest";
import { analyzeQuery, rankSearchResults, PROVIDER_LIMIT } from "@/lib/google-books/strategy";
import type { NormalizedBook } from "@/lib/google-books/types";

function makeBook(overrides: Partial<NormalizedBook> = {}): NormalizedBook {
  return {
    externalSource: "google_books",
    externalId: "default-id",
    title: "Default Title",
    authors: ["Default Author"],
    publishedYear: 2020,
    isbn: null,
    coverUrl: null,
    ...overrides,
  };
}

// ─── analyzeQuery ─────────────────────────────────────────────────────────────

describe("analyzeQuery", () => {
  describe("ISBN detection", () => {
    it("detects a valid ISBN-13 and returns kind=isbn", () => {
      const analysis = analyzeQuery("9780132350884");
      expect(analysis.kind).toBe("isbn");
      if (analysis.kind === "isbn") {
        expect(analysis.isbn).toBe("9780132350884");
        expect(analysis.googleQuery).toBe("isbn:9780132350884");
      }
    });

    it("detects a valid ISBN-10 and returns kind=isbn", () => {
      const analysis = analyzeQuery("0132350882");
      expect(analysis.kind).toBe("isbn");
      if (analysis.kind === "isbn") {
        expect(analysis.isbn).toBe("0132350882");
      }
    });

    it("detects ISBN-13 with dashes by stripping non-digit characters", () => {
      const analysis = analyzeQuery("978-0-13-235088-4");
      expect(analysis.kind).toBe("isbn");
    });

    it("treats an invalid ISBN-13 checksum as a text query", () => {
      // Change last digit to invalidate checksum
      const analysis = analyzeQuery("9780132350885");
      expect(analysis.kind).toBe("text");
    });
  });

  describe("title-author detection", () => {
    it("detects 'Title by Author' pattern and returns kind=title-author", () => {
      const analysis = analyzeQuery("Clean Code by Robert Martin");
      expect(analysis.kind).toBe("title-author");
      if (analysis.kind === "title-author") {
        expect(analysis.title).toBe("Clean Code");
        expect(analysis.author).toBe("Robert Martin");
        expect(analysis.googleQuery).toContain("intitle:");
        expect(analysis.googleQuery).toContain("inauthor:");
      }
    });

    it("is case-insensitive for the 'by' separator", () => {
      const analysis = analyzeQuery("Dune BY Frank Herbert");
      expect(analysis.kind).toBe("title-author");
    });

    it("returns kind=text when title or author is too short", () => {
      // "A by B" — title 'A' is 1 char, below min of 2
      const analysis = analyzeQuery("A by B");
      expect(analysis.kind).toBe("text");
    });
  });

  describe("text query", () => {
    it("returns kind=text for a plain search term", () => {
      const analysis = analyzeQuery("software architecture");
      expect(analysis.kind).toBe("text");
      if (analysis.kind === "text") {
        expect(analysis.googleQuery).toBe("software architecture");
        expect(analysis.tokens.length).toBeGreaterThan(0);
      }
    });

    it("trims whitespace from the query", () => {
      const analysis = analyzeQuery("  clean code  ");
      if (analysis.kind === "text") {
        expect(analysis.query).toBe("clean code");
      }
    });

    it("collapses multiple spaces into one", () => {
      const analysis = analyzeQuery("clean    code");
      if (analysis.kind === "text") {
        expect(analysis.query).toBe("clean code");
      }
    });

    it("excludes short tokens (less than 2 chars) from token list", () => {
      const analysis = analyzeQuery("a clean code");
      if (analysis.kind === "text") {
        expect(analysis.tokens).not.toContain("a");
      }
    });

    it("excludes the token 'by' from the token list", () => {
      const analysis = analyzeQuery("written by hand");
      if (analysis.kind === "text") {
        expect(analysis.tokens).not.toContain("by");
      }
    });
  });
});

// ─── rankSearchResults ────────────────────────────────────────────────────────

describe("rankSearchResults", () => {
  it("returns empty array when given empty results", () => {
    const analysis = analyzeQuery("clean code");
    expect(rankSearchResults([], analysis)).toEqual([]);
  });

  it("ranks exact title match above partial match", () => {
    const exact = makeBook({ title: "Clean Code" });
    const partial = makeBook({ title: "Clean Code and Beyond", externalId: "other" });
    const analysis = analyzeQuery("clean code");
    const ranked = rankSearchResults([partial, exact], analysis);
    expect(ranked[0]!.externalId).toBe(exact.externalId);
  });

  it("for ISBN query: returns only the book with the matching ISBN", () => {
    const matching = makeBook({ isbn: "9780132350884", externalId: "match" });
    const nonMatching = makeBook({ isbn: "9780000000000", externalId: "no-match" });
    const analysis = analyzeQuery("9780132350884");
    const ranked = rankSearchResults([nonMatching, matching], analysis);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.externalId).toBe("match");
  });

  it("for ISBN query: returns empty array when no book matches the ISBN", () => {
    const book = makeBook({ isbn: "9780000000000", externalId: "no-match" });
    const analysis = analyzeQuery("9780132350884");
    const ranked = rankSearchResults([book], analysis);
    expect(ranked).toHaveLength(0);
  });

  it("preserves original order when scores are equal (stable sort)", () => {
    const bookA = makeBook({ title: "Unrelated A", externalId: "a" });
    const bookB = makeBook({ title: "Unrelated B", externalId: "b" });
    const analysis = analyzeQuery("xyz-no-match-term");
    const ranked = rankSearchResults([bookA, bookB], analysis);
    // Both get the same score; original order should be preserved
    expect(ranked[0]!.externalId).toBe("a");
    expect(ranked[1]!.externalId).toBe("b");
  });

  it(`limits results to PROVIDER_LIMIT (${PROVIDER_LIMIT})`, () => {
    const books = Array.from({ length: PROVIDER_LIMIT + 10 }, (_, i) =>
      makeBook({ title: "matching title", externalId: `book-${i}` })
    );
    const analysis = analyzeQuery("matching title");
    const ranked = rankSearchResults(books, analysis);
    expect(ranked.length).toBeLessThanOrEqual(PROVIDER_LIMIT);
  });

  it("title-author query boosts book matching both title and author", () => {
    const exact = makeBook({
      title: "Dune",
      authors: ["Frank Herbert"],
      externalId: "dune",
    });
    const titleOnly = makeBook({
      title: "Dune",
      authors: ["Someone Else"],
      externalId: "other-dune",
    });
    const analysis = analyzeQuery("Dune by Frank Herbert");
    const ranked = rankSearchResults([titleOnly, exact], analysis);
    expect(ranked[0]!.externalId).toBe("dune");
  });
});
