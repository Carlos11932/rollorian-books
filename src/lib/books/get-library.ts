import "server-only";

import { prisma } from "@/lib/prisma";
import { type BookStatus, type UserBookWithBook, BOOK_STATUS_VALUES } from "@/lib/types/book";
import { isMissingUserBookSchemaError } from "@/lib/prisma-schema-compat";
import { USER_BOOK_SELECT } from "./user-book-select";

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
    // Use explicit select to avoid requesting columns that may not exist
    const results = await prisma.userBook.findMany({
      where,
      select: USER_BOOK_SELECT,
      orderBy: { createdAt: "desc" },
    });

    return results.map((entry) => ({ ...entry, finishedAt: null }));
  } catch (error) {
    if (isMissingUserBookSchemaError(error)) {
      return [];
    }

    throw error;
  }
}
