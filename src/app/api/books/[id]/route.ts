import "server-only";

import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import type { Book } from "@/lib/types/book";
import { prisma } from "@/lib/prisma";
import { updateBookSchema } from "@/lib/schemas/book";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function revalidateBookCollectionPaths(bookId: string) {
  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath(`/books/${bookId}`);
}

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    const book: Book | null = await prisma.book.findUnique({
      where: { id, ownerId: userId },
    });

    if (!book) {
      return Response.json({ error: "Book not found" }, { status: 404 });
    }

    return Response.json(book);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
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
    const { id } = await params;

    const existing: Book | null = await prisma.book.findUnique({
      where: { id, ownerId: userId },
    });
    if (!existing) {
      return Response.json({ error: "Book not found" }, { status: 404 });
    }

    const body: unknown = await request.json();
    const result = updateBookSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        { error: result.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const book: Book = await prisma.book.update({
      where: { id },
      data: result.data,
    });

    revalidateBookCollectionPaths(id);

    return Response.json(book);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
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
    const { id } = await params;

    const existing: Book | null = await prisma.book.findUnique({
      where: { id, ownerId: userId },
    });
    if (!existing) {
      return Response.json({ error: "Book not found" }, { status: 404 });
    }

    await prisma.book.delete({ where: { id } });

    revalidateBookCollectionPaths(id);

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[DELETE /api/books/[id]]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
