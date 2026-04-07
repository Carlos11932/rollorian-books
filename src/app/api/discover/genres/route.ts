import "server-only";

import { unstable_cache } from "next/cache";
import type { NextRequest } from "next/server";
import { searchBooks } from "@/lib/book-providers/search-orchestrator";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";
import type { NormalizedBook } from "@/lib/book-providers/types";
import { logger } from "@/lib/logger";

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_GENRES = [
  "Fiction",
  "Science Fiction",
  "Fantasy",
  "History",
  "Romance",
  "Mystery",
  "Philosophy",
];

const BOOKS_PER_GENRE = 12;

// ── Cached fetcher ───────────────────────────────────────────────────────────

/**
 * Fetches books for a single genre from all providers and caches for 6 hours.
 * Using per-genre caching so individual genres can revalidate independently.
 */
function fetchGenreBooks(genre: string) {
  return unstable_cache(
    async (): Promise<NormalizedBook[]> => {
      const books = await searchBooks(`subject:${genre}`, {
        maxResults: BOOKS_PER_GENRE,
      });
      return books.slice(0, BOOKS_PER_GENRE);
    },
    [`discover-genre-${genre}`],
    { revalidate: 21600, tags: [`discover-genre-${genre}`] },
  )();
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<Response> {
  try {
    await requireAuth();

    const rawGenres = request.nextUrl.searchParams.get("genres");
    const genres =
      rawGenres != null && rawGenres.trim().length > 0
        ? rawGenres.split(",").map((g) => g.trim()).filter(Boolean)
        : DEFAULT_GENRES;

    // Fetch all genres sequentially to avoid hammering Google Books API
    const results: { name: string; books: NormalizedBook[] }[] = [];
    for (const genre of genres) {
      const books = await fetchGenreBooks(genre);
      results.push({ name: genre, books });
    }

    return Response.json({ genres: results });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Request failed", error, { endpoint: "GET /api/discover/genres" });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
