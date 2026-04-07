import "server-only";

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isMissingListsSchemaError } from "@/lib/prisma-schema-compat";
import { addListItemSchema } from "@/lib/schemas/list";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";
import { logger } from "@/lib/logger";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: NextRequest,
  { params }: RouteContext,
): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const { id: listId } = await params;

    // Verify list ownership
    const list = await prisma.bookList.findUnique({ where: { id: listId } });
    if (!list) {
      return Response.json({ error: "List not found" }, { status: 404 });
    }
    if (list.userId !== userId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body: unknown = await request.json();
    const result = addListItemSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        { error: result.error.issues.map((i) => i.message).join(", ") },
        { status: 400 },
      );
    }

    const { bookId } = result.data;

    // Check book exists
    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) {
      return Response.json({ error: "Book not found" }, { status: 404 });
    }

    // Check for duplicate
    const existing = await prisma.bookListItem.findUnique({
      where: { listId_bookId: { listId, bookId } },
    });
    if (existing) {
      return Response.json({ error: "Already in this list" }, { status: 409 });
    }

    const item = await prisma.bookListItem.create({
      data: { listId, bookId },
      include: { book: true },
    });

    return Response.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isMissingListsSchemaError(error)) {
      return Response.json({ error: "Lists feature unavailable until database schema is updated" }, { status: 503 });
    }
    logger.error("Request failed", error, { endpoint: "POST /api/lists/[id]/items" });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext,
): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const { id: listId } = await params;

    // Verify list ownership
    const list = await prisma.bookList.findUnique({ where: { id: listId } });
    if (!list) {
      return Response.json({ error: "List not found" }, { status: 404 });
    }
    if (list.userId !== userId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body: unknown = await request.json();
    const parsed = addListItemSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 },
      );
    }

    const { bookId } = parsed.data;

    const existing = await prisma.bookListItem.findUnique({
      where: { listId_bookId: { listId, bookId } },
    });
    if (!existing) {
      return Response.json({ error: "Book not in this list" }, { status: 404 });
    }

    await prisma.bookListItem.delete({
      where: { listId_bookId: { listId, bookId } },
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isMissingListsSchemaError(error)) {
      return Response.json({ error: "Lists feature unavailable until database schema is updated" }, { status: 503 });
    }
    logger.error("Request failed", error, { endpoint: "DELETE /api/lists/[id]/items" });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
