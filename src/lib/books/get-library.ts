import "server-only";

import { prisma } from "@/lib/prisma";
import { type BookStatus, type UserBookWithBook, BOOK_STATUS_VALUES } from "@/lib/types/book";

const VALID_STATUSES = new Set<string>(BOOK_STATUS_VALUES);

export function isBookStatus(value: string): value is BookStatus {
  return VALID_STATUSES.has(value);
}

/**
 * Fetches all library entries for a user, optionally filtered by status and search query.
 */
export async function getLibrary(
  userId: string,
  options?: { status?: BookStatus; q?: string },
): Promise<UserBookWithBook[]> {
  const userBooks: UserBookWithBook[] = await prisma.userBook.findMany({
    where: {
      userId,
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.q && options.q.trim().length > 0
        ? {
            book: {
              OR: [
                { title: { contains: options.q, mode: "insensitive" } },
                { authors: { has: options.q } },
              ],
            },
          }
        : {}),
    },
    include: { book: true },
    orderBy: { createdAt: "desc" },
  });

  return userBooks;
}
