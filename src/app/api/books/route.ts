import "server-only";

import type { NextRequest } from "next/server";
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

    return Response.json(userBook, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof DuplicateLibraryEntryError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    console.error("[POST /api/books]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
