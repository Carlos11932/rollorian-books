import "server-only";

import { prisma } from "@/lib/prisma";
import {
  getUserBookCompatFallbackAttempts,
  isMissingUserBookSchemaError,
  isRetryableUserBookCompatError,
  type UserBookCompatAttempt,
} from "@/lib/prisma-schema-compat";
import { type BookStatus, type UserBookWithBook, BOOK_STATUS_VALUES } from "@/lib/types/book";
import { USER_BOOK_SELECT } from "./user-book-select";

const VALID_STATUSES = new Set<string>(BOOK_STATUS_VALUES);
const FULL_USER_BOOK_READ_ATTEMPT: UserBookCompatAttempt = {
  includeOwnershipStatus: true,
  includeFinishedAt: true,
};

export function isBookStatus(value: string): value is BookStatus {
  return VALID_STATUSES.has(value);
}

export type LibraryListEntryResult = UserBookWithBook & {
  compatDegraded?: true;
};

/**
 * Fetches all library entries for a user, optionally filtered by status and search query.
 */
export async function getLibrary(
  userId: string,
  options?: { status?: BookStatus; q?: string },
): Promise<LibraryListEntryResult[]> {
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
    return await findLibraryEntriesWithCompat(where, FULL_USER_BOOK_READ_ATTEMPT);
  } catch (error) {
    if (isMissingUserBookSchemaError(error)) {
      return [];
    }

    throw error;
  }
}

type LibraryWhere = {
  userId: string;
  status?: BookStatus;
  book?: {
    OR: Array<
      | { title: { contains: string; mode: "insensitive" } }
      | { authors: { has: string } }
    >;
  };
};

async function findLibraryEntriesWithCompat(
  where: LibraryWhere,
  initialAttempt: UserBookCompatAttempt,
): Promise<LibraryListEntryResult[]> {
  const attempts: UserBookCompatAttempt[] = [initialAttempt];
  let lastError: unknown;

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];

    if (!attempt) {
      continue;
    }

    try {
      return await readLibraryEntriesAttempt(where, attempt);
    } catch (error) {
      lastError = error;

      if (!isRetryableUserBookCompatError(error)) {
        throw error;
      }

      for (const fallbackAttempt of getUserBookCompatFallbackAttempts(attempt, error)) {
        if (!hasAttempt(attempts, fallbackAttempt)) {
          attempts.push(fallbackAttempt);
        }
      }
    }
  }

  throw lastError;
}

async function readLibraryEntriesAttempt(
  where: LibraryWhere,
  attempt: UserBookCompatAttempt,
): Promise<LibraryListEntryResult[]> {
  if (attempt.includeOwnershipStatus && attempt.includeFinishedAt) {
    return prisma.userBook.findMany({
      where,
      select: {
        ...USER_BOOK_SELECT,
        finishedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  if (attempt.includeOwnershipStatus) {
    const results = await prisma.userBook.findMany({
      where,
      select: USER_BOOK_SELECT,
      orderBy: { createdAt: "desc" },
    });

    return results.map((entry) => ({ ...entry, finishedAt: null, compatDegraded: true }));
  }

  if (attempt.includeFinishedAt) {
    const results = await prisma.userBook.findMany({
      where,
      select: {
        id: true,
        userId: true,
        bookId: true,
        status: true,
        finishedAt: true,
        rating: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        book: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return results.map((entry) => ({ ...entry, ownershipStatus: "UNKNOWN", compatDegraded: true }));
  }

  const results = await prisma.userBook.findMany({
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

    return results.map((entry) => ({
      ...entry,
      ownershipStatus: "UNKNOWN",
      finishedAt: null,
      compatDegraded: true,
    }));
}

function hasAttempt(
  attempts: UserBookCompatAttempt[],
  candidate: UserBookCompatAttempt,
): boolean {
  return attempts.some((attempt) => (
    attempt.includeOwnershipStatus === candidate.includeOwnershipStatus
    && attempt.includeFinishedAt === candidate.includeFinishedAt
  ));
}
