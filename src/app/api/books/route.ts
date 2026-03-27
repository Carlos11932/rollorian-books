import "server-only";

import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { type BookStatus, type UserBookWithBook, BOOK_STATUS_VALUES } from "@/lib/types/book";
import { prisma } from "@/lib/prisma";
import { createBookSchema } from "@/lib/schemas/book";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";

const VALID_STATUSES = new Set<string>(BOOK_STATUS_VALUES);

function isBookStatus(value: string): value is BookStatus {
  return VALID_STATUSES.has(value);
}

function revalidateBookCollectionPaths(bookId: string) {
  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath(`/books/${bookId}`);
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { userId } = await requireAuth();

    const searchParams = request.nextUrl.searchParams;
    const statusParam = searchParams.get("status");
    const qParam = searchParams.get("q");

    if (statusParam !== null && !isBookStatus(statusParam)) {
      return Response.json(
        {
          error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(", ")}`,
        },
        { status: 400 }
      );
    }

    const userBooks: UserBookWithBook[] = await prisma.userBook.findMany({
      where: {
        userId,
        ...(statusParam !== null && isBookStatus(statusParam)
          ? { status: statusParam }
          : {}),
        ...(qParam !== null && qParam.trim().length > 0
          ? {
              book: {
                OR: [
                  { title: { contains: qParam, mode: "insensitive" } },
                  { authors: { has: qParam } },
                ],
              },
            }
          : {}),
      },
      include: { book: true },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(userBooks);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
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

    const { status, rating, notes, ...bookFields } = result.data;

    // Find existing book by ISBN or create a new one
    let book = bookFields.isbn13
      ? await prisma.book.findFirst({ where: { isbn13: bookFields.isbn13 } })
      : bookFields.isbn10
        ? await prisma.book.findFirst({ where: { isbn10: bookFields.isbn10 } })
        : null;

    if (!book) {
      book = await prisma.book.create({ data: bookFields });
    }

    // Check if user already has this book
    const existingUserBook = await prisma.userBook.findUnique({
      where: { userId_bookId: { userId, bookId: book.id } },
    });

    if (existingUserBook) {
      return Response.json(
        { error: "Book already in your library" },
        { status: 409 }
      );
    }

    // Create the UserBook link
    const userBook: UserBookWithBook = await prisma.userBook.create({
      data: {
        userId,
        bookId: book.id,
        status,
        ...(rating !== undefined ? { rating } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
      include: { book: true },
    });

    revalidateBookCollectionPaths(book.id);

    return Response.json(userBook, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[POST /api/books]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
