import "server-only";

import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { type Book, type BookStatus, BOOK_STATUS_VALUES } from "@/lib/types/book";
import { prisma } from "@/lib/prisma";
import { createBookSchema } from "@/lib/schemas/book";

const VALID_STATUSES = new Set<string>(BOOK_STATUS_VALUES);

function isBookStatus(value: string): value is BookStatus {
  return VALID_STATUSES.has(value);
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
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

    const books: Book[] = await prisma.book.findMany({
      where: {
        ...(statusParam !== null && isBookStatus(statusParam)
          ? { status: statusParam }
          : {}),
        ...(qParam !== null && qParam.trim().length > 0
          ? {
              OR: [
                { title: { contains: qParam, mode: "insensitive" } },
                { authors: { has: qParam } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(books);
  } catch (error) {
    console.error("[GET /api/books]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body: unknown = await request.json();
    const result = createBookSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        { error: result.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const book: Book = await prisma.book.create({
      data: result.data,
    });

    revalidatePath('/');
    revalidatePath('/library');

    return Response.json(book, { status: 201 });
  } catch (error) {
    console.error("[POST /api/books]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
