import "server-only";

import type { NextRequest } from "next/server";
import { searchBooks } from "@/lib/book-providers/search-orchestrator";
import { analyzeQuery, rankSearchResults } from "@/lib/google-books/strategy";
import { searchQuerySchema } from "@/lib/schemas/book";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    await requireAuth();

    const searchParams = request.nextUrl.searchParams;
    const rawQ = searchParams.get("q");

    const result = searchQuerySchema.safeParse({ q: rawQ });

    if (!result.success) {
      return Response.json(
        { error: result.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const { q } = result.data;
    const analysis = analyzeQuery(q);

    const allResults = await searchBooks(analysis.googleQuery);
    const ranked = rankSearchResults(allResults, analysis);

    return Response.json(ranked);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/search/books]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
