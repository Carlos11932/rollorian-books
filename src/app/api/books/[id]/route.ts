import "server-only";

import type { NextRequest } from "next/server";
import { updateBookSchema } from "@/lib/schemas/book";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";
import { logger } from "@/lib/logger";
import {
  EmptyLibraryEntryUpdateError,
  LibraryEntryWriteConflictError,
  OwnershipStatusSchemaCompatError,
} from "@/lib/books/update-library-entry";
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
    if (error instanceof SyntaxError || (error instanceof Error && error.name === "SyntaxError")) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }
    if (isOwnershipStatusCompatError(error)) {
      return Response.json(
        {
          error: "Ownership status updates require a database schema that includes ownershipStatus",
          code: "OWNERSHIP_STATUS_UNSUPPORTED",
        },
        { status: 409 },
      );
    }
    if (error instanceof LibraryEntryWriteConflictError) {
      return Response.json(
        {
          error: error.message,
          code: "CONCURRENT_UPDATE_CONFLICT",
        },
        { status: 409 },
      );
    }
    if (error instanceof LibraryEntryNotFoundError) {
      return Response.json({ error: "Book not found" }, { status: 404 });
    }
    logger.error("Request failed", error, { endpoint: "GET /api/books/[id]" });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

function isOwnershipStatusCompatError(error: unknown): boolean {
  return (
    error instanceof OwnershipStatusSchemaCompatError
    || (error instanceof Error
      && error.message === "Ownership status updates require a database schema that includes ownershipStatus")
  );
}

function isLibraryEntryWriteConflictError(error: unknown): boolean {
  return (
    error instanceof LibraryEntryWriteConflictError
    || (error instanceof Error
      && error.message === "Could not update this library entry because another update happened at the same time. Please retry.")
  );
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

    if (isEmptyUpdatePayload(result.data)) {
      return Response.json({ error: "At least one field must be provided" }, { status: 400 });
    }

    const userBook = await updateLibraryEntry(userId, bookId, result.data);

    return Response.json(userBook);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof SyntaxError || (error instanceof Error && error.name === "SyntaxError")) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }
    if (isOwnershipStatusCompatError(error)) {
      return Response.json(
        {
          error: "Ownership status updates require a database schema that includes ownershipStatus",
          code: "OWNERSHIP_STATUS_UNSUPPORTED",
        },
        { status: 409 },
      );
    }
    if (isLibraryEntryWriteConflictError(error)) {
      return Response.json(
        {
          error: "Could not update this library entry because another update happened at the same time. Please retry.",
          code: "CONCURRENT_UPDATE_CONFLICT",
        },
        { status: 409 },
      );
    }
    if (error instanceof EmptyLibraryEntryUpdateError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof LibraryEntryNotFoundError) {
      return Response.json({ error: "Book not found" }, { status: 404 });
    }
    logger.error("Request failed", error, { endpoint: "PATCH /api/books/[id]" });
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
    logger.error("Request failed", error, { endpoint: "DELETE /api/books/[id]" });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

function isEmptyUpdatePayload(payload: {
  status?: string;
  ownershipStatus?: string;
  rating?: number | null;
  notes?: string | null;
}): boolean {
  return Object.keys(payload).length === 0;
}
