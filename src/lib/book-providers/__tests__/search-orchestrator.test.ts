import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BookProvider, NormalizedBook } from "../types";

// ─── Mock registry ──────────────────────────────────────────────────────────

vi.mock("@/lib/book-providers/registry", () => ({
  getProviders: vi.fn(() => [] as BookProvider[]),
}));

import { getProviders } from "@/lib/book-providers/registry";
import { searchBooks, fetchByIsbn, clearSearchCache } from "@/lib/book-providers/search-orchestrator";

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function makeProvider(
  name: string,
  overrides: Partial<BookProvider> = {}
): BookProvider {
  return {
    name,
    search: vi.fn().mockResolvedValue([]),
    fetchByIsbn: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(getProviders).mockReset();
  clearSearchCache();
});

describe("searchBooks", () => {
  it("returns results from all providers", async () => {
    const bookA = makeBook({ externalId: "a", title: "Book A" });
    const bookB = makeBook({
      externalId: "b",
      title: "Book B",
      externalSource: "open_library",
    });

    const providerA = makeProvider("google", {
      search: vi.fn().mockResolvedValue([bookA]),
    });
    const providerB = makeProvider("openlib", {
      search: vi.fn().mockResolvedValue([bookB]),
    });

    vi.mocked(getProviders).mockReturnValue([providerA, providerB]);

    const results = await searchBooks("test");

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.externalId)).toContain("a");
    expect(results.map((r) => r.externalId)).toContain("b");
  });

  it("deduplicates by ISBN", async () => {
    const isbn = "9780132350884";
    const googleBook = makeBook({
      externalId: "google-1",
      externalSource: "google_books",
      isbn,
      title: "Clean Code",
    });
    const olBook = makeBook({
      externalId: "ol-1",
      externalSource: "open_library",
      isbn,
      title: "Clean Code",
    });

    const providerA = makeProvider("google", {
      search: vi.fn().mockResolvedValue([googleBook]),
    });
    const providerB = makeProvider("openlib", {
      search: vi.fn().mockResolvedValue([olBook]),
    });

    vi.mocked(getProviders).mockReturnValue([providerA, providerB]);

    const results = await searchBooks("clean code");

    expect(results).toHaveLength(1);
    expect(results[0]!.isbn).toBe(isbn);
  });

  it("prefers Google metadata as base when merging", async () => {
    const isbn = "9780132350884";
    const googleBook = makeBook({
      externalId: "google-1",
      externalSource: "google_books",
      isbn,
      title: "Google Title",
      authors: ["Google Author"],
    });
    const olBook = makeBook({
      externalId: "ol-1",
      externalSource: "open_library",
      isbn,
      title: "OL Title",
      authors: ["OL Author"],
    });

    const providerA = makeProvider("google", {
      search: vi.fn().mockResolvedValue([googleBook]),
    });
    const providerB = makeProvider("openlib", {
      search: vi.fn().mockResolvedValue([olBook]),
    });

    vi.mocked(getProviders).mockReturnValue([providerA, providerB]);

    const results = await searchBooks("test");

    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe("Google Title");
    expect(results[0]!.authors).toEqual(["Google Author"]);
    expect(results[0]!.externalId).toBe("google-1");
    expect(results[0]!.externalSource).toBe("google_books");
  });

  it("falls back to other provider's cover when Google has none", async () => {
    const isbn = "9780132350884";
    const googleBook = makeBook({
      externalId: "google-1",
      externalSource: "google_books",
      isbn,
      coverUrl: null,
    });
    const olBook = makeBook({
      externalId: "ol-1",
      externalSource: "open_library",
      isbn,
      coverUrl: "https://covers.openlibrary.org/b/id/123-L.jpg",
    });

    const providerA = makeProvider("google", {
      search: vi.fn().mockResolvedValue([googleBook]),
    });
    const providerB = makeProvider("openlib", {
      search: vi.fn().mockResolvedValue([olBook]),
    });

    vi.mocked(getProviders).mockReturnValue([providerA, providerB]);

    const results = await searchBooks("test");

    expect(results).toHaveLength(1);
    expect(results[0]!.coverUrl).toBe(
      "https://covers.openlibrary.org/b/id/123-L.jpg"
    );
  });

  it("uses the longest description when merging", async () => {
    const isbn = "9780132350884";
    const googleBook = makeBook({
      externalId: "google-1",
      externalSource: "google_books",
      isbn,
      description: "Short",
    });
    const olBook = makeBook({
      externalId: "ol-1",
      externalSource: "open_library",
      isbn,
      description: "A much longer description from Open Library with details",
    });

    const providerA = makeProvider("google", {
      search: vi.fn().mockResolvedValue([googleBook]),
    });
    const providerB = makeProvider("openlib", {
      search: vi.fn().mockResolvedValue([olBook]),
    });

    vi.mocked(getProviders).mockReturnValue([providerA, providerB]);

    const results = await searchBooks("test");

    expect(results).toHaveLength(1);
    expect(results[0]!.description).toBe(
      "A much longer description from Open Library with details"
    );
  });

  it("merges genres from both providers, deduplicated and capped at 10", async () => {
    const isbn = "9780132350884";
    const googleBook = makeBook({
      externalId: "google-1",
      externalSource: "google_books",
      isbn,
      genres: ["Fiction", "Fantasy", "Adventure"],
    });
    const olBook = makeBook({
      externalId: "ol-1",
      externalSource: "open_library",
      isbn,
      genres: ["Fantasy", "Sci-Fi", "Adventure", "Drama"],
    });

    const providerA = makeProvider("google", {
      search: vi.fn().mockResolvedValue([googleBook]),
    });
    const providerB = makeProvider("openlib", {
      search: vi.fn().mockResolvedValue([olBook]),
    });

    vi.mocked(getProviders).mockReturnValue([providerA, providerB]);

    const results = await searchBooks("test");

    expect(results).toHaveLength(1);
    const genres = results[0]!.genres!;
    // Union of both: Fiction, Fantasy, Adventure, Sci-Fi, Drama
    expect(genres).toContain("Fiction");
    expect(genres).toContain("Fantasy");
    expect(genres).toContain("Adventure");
    expect(genres).toContain("Sci-Fi");
    expect(genres).toContain("Drama");
    // No duplicates
    expect(new Set(genres).size).toBe(genres.length);
    expect(genres.length).toBeLessThanOrEqual(10);
  });

  it("handles provider failure gracefully", async () => {
    const book = makeBook({ externalId: "survivor" });

    const failingProvider = makeProvider("failing", {
      search: vi.fn().mockRejectedValue(new Error("Provider down")),
    });
    const successProvider = makeProvider("success", {
      search: vi.fn().mockResolvedValue([book]),
    });

    vi.mocked(getProviders).mockReturnValue([failingProvider, successProvider]);

    const results = await searchBooks("test");

    expect(results).toHaveLength(1);
    expect(results[0]!.externalId).toBe("survivor");
  });

  it("keeps books without ISBN as separate entries", async () => {
    const bookA = makeBook({
      externalId: "a",
      isbn: null,
      title: "Book A",
      authors: ["Author A"],
    });
    const bookB = makeBook({
      externalId: "b",
      isbn: null,
      title: "Book B",
      authors: ["Author B"],
      externalSource: "open_library",
    });

    const providerA = makeProvider("google", {
      search: vi.fn().mockResolvedValue([bookA]),
    });
    const providerB = makeProvider("openlib", {
      search: vi.fn().mockResolvedValue([bookB]),
    });

    vi.mocked(getProviders).mockReturnValue([providerA, providerB]);

    const results = await searchBooks("test");

    expect(results).toHaveLength(2);
  });

  it("deduplicates no-ISBN books by title+author (case-insensitive)", async () => {
    const bookA = makeBook({
      externalId: "a",
      isbn: null,
      title: "The Great Book",
      authors: ["Jane Doe"],
      externalSource: "google_books",
    });
    const bookB = makeBook({
      externalId: "b",
      isbn: null,
      title: "the great book",
      authors: ["jane doe"],
      externalSource: "open_library",
    });

    const providerA = makeProvider("google", {
      search: vi.fn().mockResolvedValue([bookA]),
    });
    const providerB = makeProvider("openlib", {
      search: vi.fn().mockResolvedValue([bookB]),
    });

    vi.mocked(getProviders).mockReturnValue([providerA, providerB]);

    const results = await searchBooks("test");

    expect(results).toHaveLength(1);
  });

  it("returns empty array when both providers return empty results", async () => {
    const providerA = makeProvider("google", {
      search: vi.fn().mockResolvedValue([]),
    });
    const providerB = makeProvider("openlib", {
      search: vi.fn().mockResolvedValue([]),
    });

    vi.mocked(getProviders).mockReturnValue([providerA, providerB]);

    const results = await searchBooks("nonexistent");

    expect(results).toEqual([]);
  });
});

describe("fetchByIsbn", () => {
  it("returns merged result when both providers return a book", async () => {
    const isbn = "9780132350884";
    const googleBook = makeBook({
      externalId: "google-1",
      externalSource: "google_books",
      isbn,
      title: "Google Title",
      coverUrl: null,
      description: "Short",
    });
    const olBook = makeBook({
      externalId: "ol-1",
      externalSource: "open_library",
      isbn,
      title: "OL Title",
      coverUrl: "https://covers.openlibrary.org/cover.jpg",
      description: "A longer and more detailed description here",
    });

    const providerA = makeProvider("google", {
      fetchByIsbn: vi.fn().mockResolvedValue(googleBook),
    });
    const providerB = makeProvider("openlib", {
      fetchByIsbn: vi.fn().mockResolvedValue(olBook),
    });

    vi.mocked(getProviders).mockReturnValue([providerA, providerB]);

    const result = await fetchByIsbn(isbn);

    expect(result).not.toBeNull();
    // Google preferred as base
    expect(result!.title).toBe("Google Title");
    expect(result!.externalSource).toBe("google_books");
    // Fallback cover from OL
    expect(result!.coverUrl).toBe("https://covers.openlibrary.org/cover.jpg");
    // Longest description wins
    expect(result!.description).toBe(
      "A longer and more detailed description here"
    );
  });

  it("returns null when no provider has results", async () => {
    const providerA = makeProvider("google", {
      fetchByIsbn: vi.fn().mockResolvedValue(null),
    });
    const providerB = makeProvider("openlib", {
      fetchByIsbn: vi.fn().mockResolvedValue(null),
    });

    vi.mocked(getProviders).mockReturnValue([providerA, providerB]);

    const result = await fetchByIsbn("9780000000000");

    expect(result).toBeNull();
  });
});
