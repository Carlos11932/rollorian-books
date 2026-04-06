/**
 * Progressive search with relaxation.
 *
 * Searches for books and progressively relaxes criteria until we reach
 * the target count (40) or exhaust relaxation strategies.
 *
 * Relaxation order:
 * 1. Primary search (original query)
 * 2. Author of the top result (inauthor:"author name")
 * 3. Genre of the top result (genre keyword search)
 * 4. Progressively shorter query (remove last word each iteration)
 */

import type { NormalizedBook, SearchOptions } from "./types";
import { getProviders } from "./registry";
import { semanticDedup } from "./semantic-dedup";
import { normalizeGenres } from "./genre-normalizer";
import { analyzeQuery, rankSearchResults } from "../google-books/strategy";

const TARGET_COUNT = 40;
const MAX_RELAXATION_ROUNDS = 3;

// ---------------------------------------------------------------------------
// Result cache — prevents re-hitting external APIs on "load more"
// ---------------------------------------------------------------------------

interface ProgressiveCache {
  query: string;
  books: NormalizedBook[];
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let progressiveCache: ProgressiveCache | null = null;

function getCachedProgress(query: string): NormalizedBook[] | null {
  if (!progressiveCache) return null;
  if (progressiveCache.query !== query) return null;
  if (Date.now() - progressiveCache.timestamp > CACHE_TTL) {
    progressiveCache = null;
    return null;
  }
  return progressiveCache.books;
}

function setCachedProgress(query: string, books: NormalizedBook[]): void {
  progressiveCache = { query, books, timestamp: Date.now() };
}

// ---------------------------------------------------------------------------
// Core search (single round against all providers)
// ---------------------------------------------------------------------------

async function rawSearch(
  query: string,
  options?: SearchOptions,
): Promise<NormalizedBook[]> {
  const providers = getProviders();

  const results = await Promise.allSettled(
    providers.map((p) => p.search(query, options)),
  );

  const allBooks: NormalizedBook[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allBooks.push(...result.value);
    }
  }

  return allBooks;
}

// ---------------------------------------------------------------------------
// Relaxation strategies
// ---------------------------------------------------------------------------

interface RelaxationContext {
  originalQuery: string;
  topResult: NormalizedBook | null;
  usedQueries: Set<string>;
}

function generateRelaxedQueries(ctx: RelaxationContext): string[] {
  const queries: string[] = [];
  const { topResult, originalQuery, usedQueries } = ctx;

  // Strategy 1: Search by author of top result
  if (topResult && topResult.authors.length > 0) {
    const authorQuery = `inauthor:"${topResult.authors[0]}"`;
    if (!usedQueries.has(authorQuery)) {
      queries.push(authorQuery);
    }
  }

  // Strategy 2: Search by genre of top result
  if (topResult?.genres && topResult.genres.length > 0) {
    const normalized = normalizeGenres(topResult.genres);
    for (const genre of normalized.slice(0, 1)) {
      if (!usedQueries.has(genre)) {
        queries.push(genre);
      }
    }
  }

  // Strategy 3: Remove words progressively from the query
  const words = originalQuery.trim().split(/\s+/);
  for (let len = words.length - 1; len >= 2; len--) {
    const shorter = words.slice(0, len).join(" ");
    if (!usedQueries.has(shorter)) {
      queries.push(shorter);
      break; // one at a time
    }
  }

  return queries;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ProgressiveSearchResult {
  books: NormalizedBook[];
  hasMore: boolean;
  nextOffset: number;
}

/**
 * Performs a progressive search:
 * 1. Runs the primary query
 * 2. If results < TARGET_COUNT, relaxes progressively
 * 3. Deduplicates semantically at each step
 * 4. Supports offset-based pagination for "load more"
 */
export async function progressiveSearch(
  query: string,
  offset: number = 0,
): Promise<ProgressiveSearchResult> {
  const primaryQuery = query.trim();

  // Check cache first — "load more" reuses previous full result set
  const cached = getCachedProgress(primaryQuery);
  if (cached && cached.length >= offset + TARGET_COUNT) {
    const page = cached.slice(offset, offset + TARGET_COUNT);
    return {
      books: page,
      hasMore: cached.length > offset + TARGET_COUNT,
      nextOffset: offset + TARGET_COUNT,
    };
  }

  // Build from cached partial results or from scratch
  let allBooks: NormalizedBook[] = cached ? [...cached] : [];
  const usedQueries = new Set<string>();

  if (allBooks.length === 0) {
    // Round 0: Primary search
    usedQueries.add(primaryQuery);
    const primaryResults = await rawSearch(primaryQuery, { maxResults: 40 });
    allBooks.push(...primaryResults);
    allBooks = semanticDedup(allBooks);

    // Rank so topResult is the BEST match, not arbitrary provider order
    const analysis = analyzeQuery(primaryQuery);
    allBooks = rankSearchResults(allBooks, analysis);

    // Progressive relaxation
    const topResult = allBooks[0] ?? null;
    const ctx: RelaxationContext = {
      originalQuery: primaryQuery,
      topResult,
      usedQueries,
    };

    let round = 0;
    while (allBooks.length < TARGET_COUNT + offset && round < MAX_RELAXATION_ROUNDS) {
      const relaxedQueries = generateRelaxedQueries(ctx);
      if (relaxedQueries.length === 0) break;

      for (const rq of relaxedQueries) {
        if (allBooks.length >= TARGET_COUNT + offset) break;
        usedQueries.add(rq);

        const relaxedResults = await rawSearch(rq, { maxResults: 40 });
        allBooks.push(...relaxedResults);
        allBooks = semanticDedup(allBooks);
      }

      round++;
    }
  }

  // Cache full result set for subsequent "load more" requests
  setCachedProgress(primaryQuery, allBooks);

  // Slice page
  const page = allBooks.slice(offset, offset + TARGET_COUNT);
  const hasMore = allBooks.length > offset + TARGET_COUNT;

  return {
    books: page,
    hasMore,
    nextOffset: offset + TARGET_COUNT,
  };
}
