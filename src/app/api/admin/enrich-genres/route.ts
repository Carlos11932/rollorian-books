import "server-only";

import { prisma } from "@/lib/prisma";
import {
  requireSuperAdmin,
  UnauthorizedError,
  ForbiddenError,
} from "@/lib/auth/require-auth";
import { fetchByIsbn } from "@/lib/book-providers/search-orchestrator";

/**
 * POST /api/admin/enrich-genres
 *
 * Re-enriches genres for all books that have an ISBN but empty genres.
 * Protected by SUPERADMIN role. Processes books sequentially to avoid
 * hammering external APIs.
 */
export async function POST(): Promise<Response> {
  try {
    await requireSuperAdmin();

    // Find all books with ISBN but no genres
    const books = await prisma.book.findMany({
      where: {
        genres: { isEmpty: true },
        OR: [
          { isbn13: { not: null } },
          { isbn10: { not: null } },
        ],
      },
      select: {
        id: true,
        title: true,
        isbn13: true,
        isbn10: true,
      },
    });

    if (books.length === 0) {
      return Response.json({
        message: "No books need genre enrichment",
        enriched: 0,
        skipped: 0,
        total: 0,
      });
    }

    let enriched = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const book of books) {
      const isbn = book.isbn13 ?? book.isbn10;
      if (!isbn) {
        skipped++;
        continue;
      }

      try {
        const result = await fetchByIsbn(isbn);
        if (result?.genres && result.genres.length > 0) {
          await prisma.book.update({
            where: { id: book.id },
            data: { genres: result.genres },
          });
          enriched++;
        } else {
          skipped++;
        }
      } catch {
        errors.push(book.title);
        skipped++;
      }
    }

    return Response.json({
      message: `Genre enrichment complete`,
      enriched,
      skipped,
      total: books.length,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[POST /api/admin/enrich-genres]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
