import "server-only";

import type { NextRequest } from "next/server";
import type { BookListSummary } from "@/lib/types/book";
import { prisma } from "@/lib/prisma";
import { createListSchema } from "@/lib/schemas/list";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";

export async function GET(_request: NextRequest): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const bookId = _request.nextUrl.searchParams.get("bookId");

    const rawLists = await prisma.bookList.findMany({
      where: { userId },
      include: {
        _count: { select: { items: true } },
        ...(bookId
          ? {
              items: {
                where: { bookId },
                select: { id: true },
                take: 1,
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    const lists: BookListSummary[] = rawLists.map((list) => ({
      id: list.id,
      name: list.name,
      description: list.description,
      userId: list.userId,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
      _count: list._count,
      ...(bookId ? { containsBook: list.items.length > 0 } : {}),
    }));

    return Response.json(lists);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/lists]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { userId } = await requireAuth();

    const body: unknown = await request.json();
    const result = createListSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        { error: result.error.issues.map((i) => i.message).join(", ") },
        { status: 400 },
      );
    }

    const list: BookListSummary = await prisma.bookList.create({
      data: {
        name: result.data.name,
        description: result.data.description ?? null,
        userId,
      },
      include: { _count: { select: { items: true } } },
    });

    return Response.json(list, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[POST /api/lists]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
