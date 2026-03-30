import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";
import type { NormalizedBook } from "@/lib/book-providers/types";

// Mock the search orchestrator BEFORE importing the route so the module
// initialiser never tries to reach any book API in tests.
vi.mock("@/lib/book-providers/search-orchestrator", () => ({
  searchBooks: vi.fn(),
}));

// Import after mocks are established.
import { GET } from "@/app/api/search/books/route";
import { searchBooks } from "@/lib/book-providers/search-orchestrator";

// The global setup already mocks requireAuth — grab a typed reference
// so individual tests can override the resolved value.
const requireAuthMock = vi.mocked(requireAuth);
const searchBooksMock = vi.mocked(searchBooks);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGetRequest(q?: string): NextRequest {
  const url = q !== undefined
    ? `http://localhost/api/search/books?q=${encodeURIComponent(q)}`
    : "http://localhost/api/search/books";
  return new NextRequest(url, { method: "GET" });
}

function makeNormalizedBook(id: string, title: string): NormalizedBook {
  return {
    externalSource: "google_books",
    externalId: id,
    title,
    authors: ["Test Author"],
    publishedYear: 2023,
    isbn: null,
    coverUrl: null,
  };
}

// ─── GET /api/search/books ────────────────────────────────────────────────────

describe("GET /api/search/books", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when requireAuth throws UnauthorizedError", async () => {
    requireAuthMock.mockRejectedValueOnce(new UnauthorizedError());

    const request = makeGetRequest("clean code");
    const response = await GET(request);

    expect(response.status).toBe(401);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBe("Unauthorized");
    expect(searchBooksMock).not.toHaveBeenCalled();
  });

  it("returns 200 with normalized and ranked results on successful search", async () => {
    const books = [
      makeNormalizedBook("vol-001", "Clean Code"),
      makeNormalizedBook("vol-002", "The Clean Coder"),
    ];
    searchBooksMock.mockResolvedValueOnce(books);

    const request = makeGetRequest("clean code");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const json: unknown = await response.json();
    expect(Array.isArray(json)).toBe(true);
    const results = json as NormalizedBook[];
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("externalSource", "google_books");
    expect(results[0]).toHaveProperty("title");
    expect(searchBooksMock).toHaveBeenCalledOnce();
  });

  it("returns 400 when the q param is missing", async () => {
    const request = makeGetRequest();
    const response = await GET(request);

    expect(response.status).toBe(400);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBeTruthy();
    expect(searchBooksMock).not.toHaveBeenCalled();
  });

  it("returns 400 when q is an empty string", async () => {
    const request = makeGetRequest("");
    const response = await GET(request);

    expect(response.status).toBe(400);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBeTruthy();
    expect(searchBooksMock).not.toHaveBeenCalled();
  });
});
