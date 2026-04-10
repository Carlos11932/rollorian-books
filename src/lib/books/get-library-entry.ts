import "server-only";

import { prisma } from "@/lib/prisma";
import {
  getUserBookCompatFallbackAttempts,
  isRetryableUserBookCompatError,
  type UserBookCompatAttempt,
} from "@/lib/prisma-schema-compat";
import type { UserBookWithBook } from "@/lib/types/book";
import { LibraryEntryNotFoundError } from "./errors";
import { USER_BOOK_SELECT } from "./user-book-select";

const FULL_USER_BOOK_READ_ATTEMPT: UserBookCompatAttempt = {
  includeOwnershipStatus: true,
  includeFinishedAt: true,
};

export type LibraryEntryResult = UserBookWithBook & {
  compatDegraded?: true;
};

/**
 * Fetches a single library entry by user + book ID.
 */
export async function getLibraryEntry(
  userId: string,
  bookId: string,
): Promise<LibraryEntryResult> {
  const result = await findLibraryEntryWithCompat(
    { userId_bookId: { userId, bookId } },
    FULL_USER_BOOK_READ_ATTEMPT,
  );

  if (!result) {
    throw new LibraryEntryNotFoundError();
  }

  return result;
}

async function findLibraryEntryWithCompat(
  where: { userId_bookId: { userId: string; bookId: string } },
  initialAttempt: UserBookCompatAttempt,
): Promise<LibraryEntryResult | null> {
  const attempts: UserBookCompatAttempt[] = [initialAttempt];
  let lastError: unknown;

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];

    if (!attempt) {
      continue;
    }

    try {
      return await readLibraryEntryAttempt(where, attempt);
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

async function readLibraryEntryAttempt(
  where: { userId_bookId: { userId: string; bookId: string } },
  attempt: UserBookCompatAttempt,
): Promise<LibraryEntryResult | null> {
  if (attempt.includeOwnershipStatus && attempt.includeFinishedAt) {
    return prisma.userBook.findUnique({
      where,
      select: {
        ...USER_BOOK_SELECT,
        finishedAt: true,
      },
    });
  }

  if (attempt.includeOwnershipStatus) {
    const userBook = await prisma.userBook.findUnique({
      where,
      select: USER_BOOK_SELECT,
    });

    return userBook ? { ...userBook, finishedAt: null, compatDegraded: true } : null;
  }

  if (attempt.includeFinishedAt) {
    const userBook = await prisma.userBook.findUnique({
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
    });

    return userBook ? { ...userBook, ownershipStatus: "UNKNOWN", compatDegraded: true } : null;
  }

  const userBook = await prisma.userBook.findUnique({
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
  });

  return userBook
    ? { ...userBook, ownershipStatus: "UNKNOWN", finishedAt: null, compatDegraded: true }
    : null;
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
