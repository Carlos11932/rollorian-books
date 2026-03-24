import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchBooks, fetchBookById } from "@/lib/google-books/client";
import type { GoogleBooksVolume } from "@/lib/google-books/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeVolume(id: string, title: string): GoogleBooksVolume {
  return {
    id,
    volumeInfo: {
      title,
      authors: ["Test Author"],
      publishedDate: "2020",
      industryIdentifiers: [{ type: "ISBN_13", identifier: "9780000000000" }],
      imageLinks: { thumbnail: "http://example.com/thumb.jpg" },
    },
  };
}

function mockFetchOk(body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
    })
  );
}

function mockFetchStatus(status: number): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => ({}),
    })
  );
}

function mockFetchNetworkError(message: string): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error(message))
  );
}

// ─── fetchBooks ───────────────────────────────────────────────────────────────

describe("fetchBooks", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns volumes from a successful response", async () => {
    const volumes = [makeVolume("id1", "Book One"), makeVolume("id2", "Book Two")];
    mockFetchOk({ totalItems: 2, items: volumes });

    const result = await fetchBooks("clean code");
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe("id1");
    expect(result[1]!.id).toBe("id2");
  });

  it("returns empty array when response has no items field", async () => {
    mockFetchOk({ totalItems: 0 });
    const result = await fetchBooks("no results query");
    expect(result).toEqual([]);
  });

  it("returns empty array when items is an empty array", async () => {
    mockFetchOk({ totalItems: 0, items: [] });
    const result = await fetchBooks("empty query");
    expect(result).toEqual([]);
  });

  it("throws a descriptive error on network failure", async () => {
    mockFetchNetworkError("Network timeout");
    await expect(fetchBooks("any query")).rejects.toThrow("Failed to reach Google Books: Network timeout");
  });

  it("throws when the API responds with a non-ok status", async () => {
    mockFetchStatus(500);
    await expect(fetchBooks("any query")).rejects.toThrow("Google Books request failed with status 500");
  });

  it("includes the query string in the fetch URL", async () => {
    const volumes = [makeVolume("id1", "Clean Code")];
    const mockFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: volumes }),
    });
    vi.stubGlobal("fetch", mockFn);

    await fetchBooks("clean code");

    expect(mockFn).toHaveBeenCalledOnce();
    const calledUrl: string = mockFn.mock.calls[0]![0] as string;
    expect(calledUrl).toContain("q=clean+code");
  });

  it("sends maxResults as a query parameter", async () => {
    mockFetchOk({ items: [] });
    const mockFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    });
    vi.stubGlobal("fetch", mockFn);

    await fetchBooks("query", { maxResults: 10 });
    const calledUrl: string = mockFn.mock.calls[0]![0] as string;
    expect(calledUrl).toContain("maxResults=10");
  });
});

// ─── fetchBookById ────────────────────────────────────────────────────────────

describe("fetchBookById", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the volume for a successful response", async () => {
    const volume = makeVolume("vol123", "Single Book");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => volume,
      })
    );

    const result = await fetchBookById("vol123");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("vol123");
    expect(result!.volumeInfo.title).toBe("Single Book");
  });

  it("returns null when the volume is not found (404)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({}),
      })
    );

    const result = await fetchBookById("nonexistent-id");
    expect(result).toBeNull();
  });

  it("throws on non-ok, non-404 responses", async () => {
    mockFetchStatus(503);
    await expect(fetchBookById("vol123")).rejects.toThrow("Google Books request failed with status 503");
  });

  it("throws a descriptive error on network failure", async () => {
    mockFetchNetworkError("Connection refused");
    await expect(fetchBookById("vol123")).rejects.toThrow("Failed to reach Google Books: Connection refused");
  });

  it("returns null when response payload lacks id or volumeInfo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ unexpected: "shape" }),
      })
    );

    const result = await fetchBookById("vol123");
    expect(result).toBeNull();
  });

  it("URL-encodes the volumeId in the request path", async () => {
    const mockFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", mockFn);

    await fetchBookById("vol/with/slashes");
    const calledUrl: string = mockFn.mock.calls[0]![0] as string;
    expect(calledUrl).toContain("vol%2Fwith%2Fslashes");
  });
});
