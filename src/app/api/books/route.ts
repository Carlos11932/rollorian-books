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
import { fetchByIsbn } from "@/lib/book-providers/search-orchestrator";
import { prisma } from "@/lib/prisma";

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
    console.error("[GET /api/books]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { userId } = await requireAuth();

    const body: unknown = await request.json();
    const result = createBookSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        { error: result.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const userBook = await saveLibraryEntry(userId, result.data);

    // Fire-and-forget enrichment — fill missing metadata from other providers
    const book = userBook.book;
    if (book.isbn13 && (!book.description || !book.coverUrl || !book.pageCount)) {
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
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[POST /api/books]", error);
    return Response.json({ error: message }, { status: 500 });
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

  if (Object.keys(updates).length > 0) {
    // Fetch current book to only fill missing fields, never overwrite
    const current = await prisma.book.findUnique({ where: { id: bookId } });
    if (!current) return;

    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      const existing = current[key as keyof typeof current];
      if (existing === null || existing === undefined) {
        filtered[key] = value;
      }
    }

    if (Object.keys(filtered).length > 0) {
      await prisma.book.update({ where: { id: bookId }, data: filtered });
    }
  }
}
