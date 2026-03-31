import type { NormalizedBook, SearchOptions } from "./types";
import { getProviders } from "./registry";

// ---------------------------------------------------------------------------
// In-memory search cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  results: NormalizedBook[];
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX_SIZE = 100;
const searchCache = new Map<string, CacheEntry>();

function normalizeQueryKey(query: string): string {
  return query.trim().toLowerCase();
}

function getCacheKey(query: string, options?: SearchOptions): string {
  const normalizedQuery = normalizeQueryKey(query);
  if (!options) return normalizedQuery;

  return JSON.stringify({
    query: normalizedQuery,
    maxResults: options.maxResults ?? null,
    language: options.language ?? null,
  });
}

function getCachedResults(key: string): NormalizedBook[] | null {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    searchCache.delete(key);
    return null;
  }
  return entry.results;
}

function setCachedResults(key: string, results: NormalizedBook[]): void {
  // Evict oldest entries if at capacity
  if (searchCache.size >= CACHE_MAX_SIZE) {
    const oldest = searchCache.keys().next().value;
    if (oldest) searchCache.delete(oldest);
  }
  searchCache.set(key, { results, timestamp: Date.now() });
}

export function clearSearchCache(): void {
  searchCache.clear();
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function searchBooks(
  query: string,
  options?: SearchOptions
): Promise<NormalizedBook[]> {
  const cacheKey = getCacheKey(query, options);
  const cached = getCachedResults(cacheKey);
  if (cached) return cached;

  const providers = getProviders();

  const results = await Promise.allSettled(
    providers.map((p) => p.search(query, options))
  );

  const allBooks: NormalizedBook[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allBooks.push(...result.value);
    }
  }

  const merged = deduplicateAndMerge(allBooks);
  setCachedResults(cacheKey, merged);
  return merged;
}

export async function fetchByIsbn(
  isbn: string
): Promise<NormalizedBook | null> {
  const providers = getProviders();

  const results = await Promise.allSettled(
    providers.map((p) => p.fetchByIsbn?.(isbn) ?? Promise.resolve(null))
  );

  const books = results
    .filter(
      (r): r is PromiseFulfilledResult<NormalizedBook | null> =>
        r.status === "fulfilled"
    )
    .map((r) => r.value)
    .filter((b): b is NormalizedBook => b !== null);

  if (books.length === 0) return null;
  if (books.length === 1) return books[0]!;
  return mergeBooks(books);
}

function deduplicateAndMerge(books: NormalizedBook[]): NormalizedBook[] {
  const byIsbn = new Map<string, NormalizedBook[]>();
  const noIsbn: NormalizedBook[] = [];

  for (const book of books) {
    if (book.isbn) {
      const existing = byIsbn.get(book.isbn) ?? [];
      existing.push(book);
      byIsbn.set(book.isbn, existing);
    } else {
      noIsbn.push(book);
    }
  }

  const merged: NormalizedBook[] = [];
  for (const group of byIsbn.values()) {
    merged.push(group.length === 1 ? group[0]! : mergeBooks(group));
  }

  const seen = new Set<string>();
  for (const book of noIsbn) {
    const key = `${book.title.toLowerCase()}|${book.authors
      .map((a) => a.toLowerCase())
      .sort()
      .join(",")}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(book);
    }
  }

  return merged;
}

function mergeBooks(books: NormalizedBook[]): NormalizedBook {
  const google = books.find((b) => b.externalSource === "google_books");
  const base = google ?? books[0]!;

  const coverUrl =
    base.coverUrl ?? books.find((b) => b.coverUrl)?.coverUrl ?? null;

  // Last-resort cover: use Open Library cover by ISBN when no provider supplied one
  const isbn = base.isbn ?? books.find((b) => b.isbn)?.isbn;
  const fallbackCover =
    coverUrl === null && isbn
      ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
      : coverUrl;

  return {
    ...base,
    coverUrl: fallbackCover,
    description: pickLongest(books.map((b) => b.description)),
    pageCount: base.pageCount ?? books.find((b) => b.pageCount)?.pageCount,
    publisher: base.publisher ?? books.find((b) => b.publisher)?.publisher,
    genres: mergeGenres(books),
    subtitle: base.subtitle ?? books.find((b) => b.subtitle)?.subtitle,
  };
}

function pickLongest(values: (string | undefined)[]): string | undefined {
  return values
    .filter((v): v is string => v !== undefined && v.length > 0)
    .sort((a, b) => b.length - a.length)[0];
}

function mergeGenres(books: NormalizedBook[]): string[] | undefined {
  const allGenres = books.flatMap((b) => b.genres ?? []);
  if (allGenres.length === 0) return undefined;
  return [...new Set(allGenres)].slice(0, 10);
}
