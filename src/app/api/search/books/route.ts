import "server-only";

import type { NextRequest } from "next/server";
import { analyzeQuery, rankSearchResults } from "@/lib/google-books/strategy";
import { progressiveSearch } from "@/lib/book-providers/progressive-search";
import { searchQuerySchema } from "@/lib/schemas/book";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    await requireAuth();

    const searchParams = request.nextUrl.searchParams;
    const rawQ = searchParams.get("q");
    const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);

    const result = searchQuerySchema.safeParse({ q: rawQ });

    if (!result.success) {
      return Response.json(
        { error: result.error.issues.map((i) => i.message).join(", ") },
        { status: 400 },
      );
    }

    const { q } = result.data;
    const analysis = analyzeQuery(q);

    // Use progressive search with the user's ORIGINAL query for relaxation,
    // not analysis.googleQuery which may contain intitle:/inauthor: operators
    // that break when words are removed progressively.
    const searchResult = await progressiveSearch(q, offset);

    // Rank results using the existing scoring system
    const ranked = rankSearchResults(searchResult.books, analysis);

    return Response.json({
      books: ranked,
      hasMore: searchResult.hasMore,
      nextOffset: searchResult.nextOffset,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Request failed", error, { endpoint: "GET /api/search/books" });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
