import "server-only";

import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import type { UserBookWithBook } from "@/lib/types/book";
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
    const { id: bookId } = await params;

    const userBook: UserBookWithBook | null = await prisma.userBook.findUnique({
      where: { userId_bookId: { userId, bookId } },
      include: { book: true },
    });

    if (!userBook) {
      return Response.json({ error: "Book not found" }, { status: 404 });
    }

    return Response.json(userBook);
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
    const { id: bookId } = await params;

    const existing = await prisma.userBook.findUnique({
      where: { userId_bookId: { userId, bookId } },
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

    const userBook: UserBookWithBook = await prisma.userBook.update({
      where: { userId_bookId: { userId, bookId } },
      data: result.data,
      include: { book: true },
    });

    revalidateBookCollectionPaths(bookId);

    return Response.json(userBook);
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
    const { id: bookId } = await params;

    const existing = await prisma.userBook.findUnique({
      where: { userId_bookId: { userId, bookId } },
    });
    if (!existing) {
      return Response.json({ error: "Book not found" }, { status: 404 });
    }

    await prisma.userBook.delete({
      where: { userId_bookId: { userId, bookId } },
    });

    revalidateBookCollectionPaths(bookId);

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[DELETE /api/books/[id]]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
