import "server-only";

import { after, type NextRequest } from "next/server";
import { BOOK_STATUS_VALUES } from "@/lib/types/book";
import { createBookSchema } from "@/lib/schemas/book";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";
import {
  getLibrary,
  isBookStatus,
  InvalidStatusError,
  saveLibraryEntry,
  DuplicateLibraryEntryError,
} from "@/lib/books";
import {
  LibraryEntryCreateConflictError,
  OwnershipStatusCreateCompatError,
} from "@/lib/books/save-library-entry";
import { fetchByIsbn } from "@/lib/book-providers/search-orchestrator";
import { prisma } from "@/lib/prisma";
import { createRateLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const postLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 20 });

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { userId } = await requireAuth();

    const searchParams = request.nextUrl.searchParams;
    const statusParam = searchParams.get("status");
    const qParam = searchParams.get("q");

    if (statusParam !== null && !isBookStatus(statusParam)) {
      throw new InvalidStatusError([...BOOK_STATUS_VALUES]);
    }

    // After the guard above, statusParam is either null or a valid BookStatus
    const userBooks = await getLibrary(userId, {
      status: statusParam ?? undefined,
      q: qParam ?? undefined,
    });

    return Response.json(userBooks);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof InvalidStatusError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    logger.error("Request failed", error, { endpoint: "GET /api/books" });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { userId } = await requireAuth();

    const rateLimitResult = postLimiter.check(userId);
    if (!rateLimitResult.allowed) {
      logger.warn("Rate limit exceeded", { endpoint: "POST /api/books", userId });
      return rateLimitResponse(rateLimitResult);
    }

    const body: unknown = await request.json();
    const result = createBookSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        { error: result.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const ownershipStatusRequested = hasExplicitOwnershipStatusRequest(body, result.data.ownershipStatus);
    const userBook = await saveLibraryEntry(userId, result.data, { ownershipStatusRequested });

    // Fire-and-forget enrichment — fill missing metadata from other providers
    const book = userBook.book;
    const hasGenres = Array.isArray(book.genres) && book.genres.length > 0;
    if (book.isbn13 && (!book.description || !book.coverUrl || !book.pageCount || !hasGenres)) {
      after(async () => {
        try {
          await enrichBookMetadata(book.id, book.isbn13!);
        } catch {
          // Intentionally swallowed — enrichment is best-effort
        }
      });
    }

    return Response.json(userBook, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof DuplicateLibraryEntryError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof OwnershipStatusCreateCompatError) {
      return Response.json(
        {
          error: error.message,
          code: "OWNERSHIP_STATUS_UNSUPPORTED",
        },
        { status: 409 },
      );
    }
    if (error instanceof LibraryEntryCreateConflictError) {
      return Response.json(
        {
          error: error.message,
          code: "CONCURRENT_CREATE_CONFLICT",
        },
        { status: 409 },
      );
    }
    logger.error("Request failed", error, { endpoint: "POST /api/books" });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Metadata enrichment (fire-and-forget)
// ---------------------------------------------------------------------------

async function enrichBookMetadata(
  bookId: string,
  isbn: string
): Promise<void> {
  const enriched = await fetchByIsbn(isbn);
  if (!enriched) return;

  const updates: Record<string, unknown> = {};

  if (enriched.description) updates.description = enriched.description;
  if (enriched.coverUrl) updates.coverUrl = enriched.coverUrl;
  if (enriched.pageCount) updates.pageCount = enriched.pageCount;
  if (enriched.publisher) updates.publisher = enriched.publisher;
  if (enriched.subtitle) updates.subtitle = enriched.subtitle;
  if (enriched.genres && enriched.genres.length > 0) updates.genres = enriched.genres;

  if (Object.keys(updates).length > 0) {
    // Fetch current book to only fill missing fields, never overwrite
    const current = await prisma.book.findUnique({ where: { id: bookId } });
    if (!current) return;

    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      const existing = current[key as keyof typeof current];
      // For arrays (genres), treat empty array as missing
      const isEmpty = Array.isArray(existing) ? existing.length === 0 : false;
      if (existing === null || existing === undefined || isEmpty) {
        filtered[key] = value;
      }
    }

    if (Object.keys(filtered).length > 0) {
      await prisma.book.update({ where: { id: bookId }, data: filtered });
    }
  }
}

function hasOwn(value: unknown, key: string): boolean {
  return typeof value === "object" && value !== null && Object.prototype.hasOwnProperty.call(value, key);
}

function hasExplicitOwnershipStatusRequest(
  value: unknown,
  ownershipStatus: string,
): boolean {
  return hasOwn(value, "ownershipStatus") && ownershipStatus !== "UNKNOWN";
}
