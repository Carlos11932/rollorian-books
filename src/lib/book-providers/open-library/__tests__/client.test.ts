import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchOpenLibrary, fetchByIsbn } from "@/lib/book-providers/open-library/client";
import type { OpenLibraryDoc } from "@/lib/book-providers/open-library/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDoc(key: string, title: string): OpenLibraryDoc {
  return {
    key,
    title,
    author_name: ["Test Author"],
    first_publish_year: 2020,
    isbn: ["9780000000000"],
    cover_i: 12345,
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

// ─── searchOpenLibrary ───────────────────────────────────────────────────────

describe("searchOpenLibrary", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns docs from a successful response", async () => {
    const docs = [makeDoc("/works/OL1W", "Book One"), makeDoc("/works/OL2W", "Book Two")];
    mockFetchOk({ numFound: 2, docs });

    const result = await searchOpenLibrary("clean code");
    expect(result).toHaveLength(2);
    expect(result[0]!.key).toBe("/works/OL1W");
    expect(result[1]!.key).toBe("/works/OL2W");
  });

  it("returns empty array when response has no docs", async () => {
    mockFetchOk({ numFound: 0 });
    const result = await searchOpenLibrary("no results query");
    expect(result).toEqual([]);
  });

  it("returns empty array on network failure", async () => {
    mockFetchNetworkError("Network timeout");
    const result = await searchOpenLibrary("any query");
    expect(result).toEqual([]);
  });

  it("returns empty array on non-ok HTTP status", async () => {
    mockFetchStatus(500);
    const result = await searchOpenLibrary("any query");
    expect(result).toEqual([]);
  });

  it("returns empty array on abort/timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("The operation was aborted", "AbortError"))
    );

    const result = await searchOpenLibrary("slow query");
    expect(result).toEqual([]);
  });

  it("includes query and limit in the fetch URL", async () => {
    const mockFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ numFound: 0, docs: [] }),
    });
    vi.stubGlobal("fetch", mockFn);

    await searchOpenLibrary("clean code", { limit: 10 });

    expect(mockFn).toHaveBeenCalledOnce();
    const calledUrl: string = mockFn.mock.calls[0]![0] as string;
    expect(calledUrl).toContain("q=clean+code");
    expect(calledUrl).toContain("limit=10");
    expect(calledUrl).toContain("fields=");
  });

  it("includes language filter when provided", async () => {
    const mockFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ numFound: 0, docs: [] }),
    });
    vi.stubGlobal("fetch", mockFn);

    await searchOpenLibrary("query", { language: "eng" });

    const calledUrl: string = mockFn.mock.calls[0]![0] as string;
    expect(calledUrl).toContain("language=eng");
  });

  it("passes abort signal to fetch", async () => {
    const mockFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ numFound: 0, docs: [] }),
    });
    vi.stubGlobal("fetch", mockFn);

    await searchOpenLibrary("query");

    const fetchOptions = mockFn.mock.calls[0]![1] as RequestInit;
    expect(fetchOptions.signal).toBeInstanceOf(AbortSignal);
  });
});

// ─── fetchByIsbn ─────────────────────────────────────────────────────────────

describe("fetchByIsbn", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the first doc for a matching ISBN", async () => {
    const doc = makeDoc("/works/OL1W", "Found Book");
    mockFetchOk({ numFound: 1, docs: [doc] });

    const result = await fetchByIsbn("9780134494166");
    expect(result).not.toBeNull();
    expect(result!.key).toBe("/works/OL1W");
  });

  it("returns null when no doc matches the ISBN", async () => {
    mockFetchOk({ numFound: 0, docs: [] });
    const result = await fetchByIsbn("0000000000");
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetchNetworkError("Connection refused");
    const result = await fetchByIsbn("9780134494166");
    expect(result).toBeNull();
  });

  it("includes isbn: prefix in the search query", async () => {
    const mockFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ numFound: 0, docs: [] }),
    });
    vi.stubGlobal("fetch", mockFn);

    await fetchByIsbn("9780134494166");

    const calledUrl: string = mockFn.mock.calls[0]![0] as string;
    expect(calledUrl).toContain("q=isbn");
    expect(calledUrl).toContain("limit=1");
  });
});
