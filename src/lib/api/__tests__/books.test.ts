import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { saveBook, updateBook, deleteBook, ApiError } from "@/lib/api/books";
import type { Book, UserBookWithBook } from "@/lib/types/book";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: "book-123",
    title: "The Pragmatic Programmer",
    subtitle: null,
    authors: ["David Thomas", "Andrew Hunt"],
    description: null,
    coverUrl: null,
    publisher: null,
    publishedDate: "1999",
    pageCount: null,
    isbn10: null,
    isbn13: "9780135957059",
    genres: [],
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function makeJsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeEmptyResponse(status: number): Response {
  return new Response(null, { status });
}

// ── ApiError ─────────────────────────────────────────────────────────────────

describe("ApiError", () => {
  it("has the correct name, message and status", () => {
    const err = new ApiError(404, "Book not found");
    expect(err.name).toBe("ApiError");
    expect(err.message).toBe("Book not found");
    expect(err.status).toBe(404);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
  });
});

// ── saveBook ─────────────────────────────────────────────────────────────────

describe("saveBook", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the saved UserBookWithBook on a 201 response", async () => {
    const book = makeBook();
    const userBook: UserBookWithBook = {
      id: "ub-001",
      userId: "user-001",
      bookId: book.id,
      status: "WISHLIST",
      rating: null,
      notes: null,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
      book,
    };
    vi.mocked(fetch).mockResolvedValue(makeJsonResponse(userBook, 201));

    const result = await saveBook({
      title: "The Pragmatic Programmer",
      authors: ["David Thomas", "Andrew Hunt"],
      status: "WISHLIST",
      genres: [],
    });

    // JSON round-trips dates as strings — match the stable fields only
    expect(result).toMatchObject({
      id: userBook.id,
      status: userBook.status,
      book: { id: book.id, title: book.title },
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/books",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws ApiError with the server message on a 400 response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeJsonResponse({ error: "Title is required" }, 400),
    );

    await expect(
      saveBook({ title: "", authors: ["A"], status: "WISHLIST", genres: [] }),
    ).rejects.toMatchObject({ status: 400, message: "Title is required" });
  });

  it("throws an instance of ApiError on a 4xx response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeJsonResponse({ error: "Title is required" }, 400),
    );

    await expect(
      saveBook({ title: "", authors: ["A"], status: "WISHLIST", genres: [] }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("throws ApiError with fallback message when error body is not JSON", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("bad gateway", { status: 502 }));

    await expect(
      saveBook({ title: "Test", authors: ["A"], status: "WISHLIST", genres: [] }),
    ).rejects.toMatchObject({ status: 502, message: "HTTP 502" });
  });

  it("propagates network errors", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(
      saveBook({ title: "Test", authors: ["A"], status: "WISHLIST", genres: [] }),
    ).rejects.toThrow("Failed to fetch");
  });
});

// ── updateBook ───────────────────────────────────────────────────────────────

describe("updateBook", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves without a value on a 200 response", async () => {
    const book = makeBook();
    vi.mocked(fetch).mockResolvedValue(makeJsonResponse(book, 200));

    await expect(updateBook("book-123", { status: "READING" })).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledWith(
      "/api/books/book-123",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("throws ApiError on a 404 response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeJsonResponse({ error: "Book not found" }, 404),
    );

    await expect(updateBook("missing-id", { status: "READ" })).rejects.toMatchObject({
      status: 404,
      message: "Book not found",
    });
  });

  it("sends status, rating and notes in the request body", async () => {
    const book = makeBook();
    vi.mocked(fetch).mockResolvedValue(makeJsonResponse(book, 200));

    await updateBook("book-123", { status: "READ", rating: 4, notes: "Great book" });

    const [, options] = vi.mocked(fetch).mock.calls[0]!;
    expect(JSON.parse((options as RequestInit).body as string)).toEqual({
      status: "READ",
      rating: 4,
      notes: "Great book",
    });
  });
});

// ── deleteBook ───────────────────────────────────────────────────────────────

describe("deleteBook", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves without a value on a 204 response", async () => {
    vi.mocked(fetch).mockResolvedValue(makeEmptyResponse(204));

    await expect(deleteBook("book-123")).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledWith("/api/books/book-123", { method: "DELETE" });
  });

  it("throws ApiError on a 404 response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeJsonResponse({ error: "Book not found" }, 404),
    );

    await expect(deleteBook("missing-id")).rejects.toMatchObject({
      status: 404,
      message: "Book not found",
    });
  });

  it("propagates network errors", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("Network error"));

    await expect(deleteBook("book-123")).rejects.toThrow("Network error");
  });
});
