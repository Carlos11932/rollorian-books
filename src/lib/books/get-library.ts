import "server-only";

import { prisma } from "@/lib/prisma";
import { type BookStatus, type UserBookWithBook, BOOK_STATUS_VALUES } from "@/lib/types/book";
import {
  isMissingFinishedAtError,
  isMissingUserBookSchemaError,
} from "@/lib/prisma-schema-compat";

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
  const where = {
    userId,
    ...(options?.status ? { status: options.status } : {}),
    ...(options?.q && options.q.trim().length > 0
      ? {
          book: {
            OR: [
              { title: { contains: options.q, mode: "insensitive" as const } },
              { authors: { has: options.q } },
            ],
          },
        }
      : {}),
  };

  try {
    return await prisma.userBook.findMany({
      where,
      include: { book: true },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    // Check the more specific error FIRST — a missing `finishedAt` column
    // produces a message containing both "UserBook" and "finishedAt", so the
    // broader `isMissingUserBookSchemaError` would swallow it and return []
    // instead of falling through to the working legacy query.
    if (isMissingFinishedAtError(error)) {
      const legacyUserBooks = await prisma.userBook.findMany({
        where,
        select: {
          id: true,
          userId: true,
          bookId: true,
          status: true,
          rating: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          book: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return legacyUserBooks.map((entry) => ({
        ...entry,
        finishedAt: null,
      }));
    }

    if (isMissingUserBookSchemaError(error)) {
      return [];
    }

    throw error;
  }
}
