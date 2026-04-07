import "server-only";

import type { NextRequest } from "next/server";
import type { BookListWithItems } from "@/lib/types/book";
import { prisma } from "@/lib/prisma";
import { isMissingListsSchemaError } from "@/lib/prisma-schema-compat";
import { updateListSchema } from "@/lib/schemas/list";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";
import { logger } from "@/lib/logger";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    const list: BookListWithItems | null = await prisma.bookList.findUnique({
      where: { id },
      include: {
        items: {
          include: { book: true },
          orderBy: { addedAt: "desc" },
        },
      },
    });

    if (!list) {
      return Response.json({ error: "List not found" }, { status: 404 });
    }

    if (list.userId !== userId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    return Response.json(list);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isMissingListsSchemaError(error)) {
      return Response.json({ error: "List not found" }, { status: 404 });
    }
    logger.error("Request failed", error, { endpoint: "GET /api/lists/[id]" });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    const existing = await prisma.bookList.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: "List not found" }, { status: 404 });
    }
    if (existing.userId !== userId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body: unknown = await request.json();
    const result = updateListSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        { error: result.error.issues.map((i) => i.message).join(", ") },
        { status: 400 },
      );
    }

    const updated = await prisma.bookList.update({
      where: { id },
      data: result.data,
      include: { _count: { select: { items: true } } },
    });

    return Response.json(updated);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isMissingListsSchemaError(error)) {
      return Response.json({ error: "Lists feature unavailable until database schema is updated" }, { status: 503 });
    }
    logger.error("Request failed", error, { endpoint: "PATCH /api/lists/[id]" });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext,
): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    const existing = await prisma.bookList.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: "List not found" }, { status: 404 });
    }
    if (existing.userId !== userId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.bookList.delete({ where: { id } });

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isMissingListsSchemaError(error)) {
      return Response.json({ error: "Lists feature unavailable until database schema is updated" }, { status: 503 });
    }
    logger.error("Request failed", error, { endpoint: "DELETE /api/lists/[id]" });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
