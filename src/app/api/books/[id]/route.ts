import "server-only";

import type { NextRequest } from "next/server";
import { updateBookSchema } from "@/lib/schemas/book";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";
import {
  getLibraryEntry,
  updateLibraryEntry,
  deleteLibraryEntry,
  LibraryEntryNotFoundError,
} from "@/lib/books";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const { id: bookId } = await params;

    const userBook = await getLibraryEntry(userId, bookId);

    return Response.json(userBook);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof LibraryEntryNotFoundError) {
      return Response.json({ error: "Book not found" }, { status: 404 });
    }
    console.error("[GET /api/books/[id]]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const { id: bookId } = await params;

    const body: unknown = await request.json();
    const result = updateBookSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        { error: result.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const userBook = await updateLibraryEntry(userId, bookId, result.data);

    return Response.json(userBook);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof LibraryEntryNotFoundError) {
      return Response.json({ error: "Book not found" }, { status: 404 });
    }
    console.error("[PATCH /api/books/[id]]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const { id: bookId } = await params;

    await deleteLibraryEntry(userId, bookId);

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof LibraryEntryNotFoundError) {
      return Response.json({ error: "Book not found" }, { status: 404 });
    }
    console.error("[DELETE /api/books/[id]]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
