import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";
import type { NormalizedBook } from "@/lib/google-books/types";

// Mock `@/lib/google-books/client` BEFORE importing the route so the module
// initialiser never tries to reach the Google Books API in tests.
vi.mock("@/lib/google-books/client", () => ({
  fetchBooks: vi.fn(),
}));

// Import after mocks are established.
import { GET } from "@/app/api/search/books/route";
import { fetchBooks } from "@/lib/google-books/client";

// The global setup already mocks requireAuth — grab a typed reference
// so individual tests can override the resolved value.
const requireAuthMock = vi.mocked(requireAuth);
const fetchBooksMock = vi.mocked(fetchBooks);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGetRequest(q?: string): NextRequest {
  const url = q !== undefined
    ? `http://localhost/api/search/books?q=${encodeURIComponent(q)}`
    : "http://localhost/api/search/books";
  return new NextRequest(url, { method: "GET" });
}

function makeGoogleVolume(id: string, title: string) {
  return {
    id,
    volumeInfo: {
      title,
      authors: ["Test Author"],
      publishedDate: "2023",
    },
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
    expect(fetchBooksMock).not.toHaveBeenCalled();
  });

  it("returns 200 with normalized and ranked results on successful search", async () => {
    const volumes = [
      makeGoogleVolume("vol-001", "Clean Code"),
      makeGoogleVolume("vol-002", "The Clean Coder"),
    ];
    fetchBooksMock.mockResolvedValueOnce(volumes);

    const request = makeGetRequest("clean code");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const json: unknown = await response.json();
    expect(Array.isArray(json)).toBe(true);
    const results = json as NormalizedBook[];
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("externalSource", "google_books");
    expect(results[0]).toHaveProperty("title");
    expect(fetchBooksMock).toHaveBeenCalledOnce();
  });

  it("returns 400 when the q param is missing", async () => {
    const request = makeGetRequest();
    const response = await GET(request);

    expect(response.status).toBe(400);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBeTruthy();
    expect(fetchBooksMock).not.toHaveBeenCalled();
  });

  it("returns 400 when q is an empty string", async () => {
    const request = makeGetRequest("");
    const response = await GET(request);

    expect(response.status).toBe(400);
    const json: unknown = await response.json();
    expect((json as { error: string }).error).toBeTruthy();
    expect(fetchBooksMock).not.toHaveBeenCalled();
  });
});
