import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";
import type { NormalizedBook } from "@/lib/book-providers/types";

// Mock the progressive search module
vi.mock("@/lib/book-providers/progressive-search", () => ({
  progressiveSearch: vi.fn(),
}));

import { GET } from "@/app/api/search/books/route";
import { progressiveSearch } from "@/lib/book-providers/progressive-search";

const requireAuthMock = vi.mocked(requireAuth);
const progressiveSearchMock = vi.mocked(progressiveSearch);

function makeGetRequest(q?: string, offset?: number): NextRequest {
  let url = "http://localhost/api/search/books";
  const params = new URLSearchParams();
  if (q !== undefined) params.set("q", q);
  if (offset !== undefined) params.set("offset", String(offset));
  const qs = params.toString();
  if (qs) url += `?${qs}`;
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

describe("GET /api/search/books", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when requireAuth throws UnauthorizedError", async () => {
    requireAuthMock.mockRejectedValueOnce(new UnauthorizedError());

    const response = await GET(makeGetRequest("clean code"));
    expect(response.status).toBe(401);
    expect(progressiveSearchMock).not.toHaveBeenCalled();
  });

  it("returns 200 with books, hasMore, and nextOffset on successful search", async () => {
    const books = [
      makeNormalizedBook("vol-001", "Clean Code"),
      makeNormalizedBook("vol-002", "The Clean Coder"),
    ];
    progressiveSearchMock.mockResolvedValueOnce({
      books,
      hasMore: false,
      nextOffset: 40,
    });

    const response = await GET(makeGetRequest("clean code"));
    expect(response.status).toBe(200);

    const json = (await response.json()) as { books: NormalizedBook[]; hasMore: boolean; nextOffset: number };
    expect(json.books).toHaveLength(2);
    expect(json.books[0]).toHaveProperty("externalSource", "google_books");
    expect(json.hasMore).toBe(false);
    expect(json.nextOffset).toBe(40);
  });

  it("passes offset param to progressiveSearch", async () => {
    progressiveSearchMock.mockResolvedValueOnce({
      books: [],
      hasMore: false,
      nextOffset: 80,
    });

    await GET(makeGetRequest("fantasy", 40));
    expect(progressiveSearchMock).toHaveBeenCalledWith(
      expect.any(String),
      40,
    );
  });

  it("returns 400 when the q param is missing", async () => {
    const response = await GET(makeGetRequest());
    expect(response.status).toBe(400);
    expect(progressiveSearchMock).not.toHaveBeenCalled();
  });

  it("returns 400 when q is an empty string", async () => {
    const response = await GET(makeGetRequest(""));
    expect(response.status).toBe(400);
    expect(progressiveSearchMock).not.toHaveBeenCalled();
  });
});
