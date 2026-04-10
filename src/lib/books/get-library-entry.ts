import "server-only";

import { prisma } from "@/lib/prisma";
import {
  getUserBookCompatFallbackAttempts,
  isMissingUserBookSchemaError,
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

const COMPAT_DEGRADED_FIELD = {
  OWNERSHIP_STATUS: "ownershipStatus",
  FINISHED_AT: "finishedAt",
} as const;

type CompatDegradedField = (typeof COMPAT_DEGRADED_FIELD)[keyof typeof COMPAT_DEGRADED_FIELD];

interface LibraryEntryCompatMetadata {
  compatDegraded?: true;
  compatDegradedFields?: CompatDegradedField[];
}

export type LibraryEntryResult = UserBookWithBook & LibraryEntryCompatMetadata;

export type LibraryEntryReadState = "full" | "degraded" | "missing" | "unavailable";

export interface LibraryEntrySnapshotResult {
  entry: LibraryEntryResult | null;
  state: LibraryEntryReadState;
}

/**
 * Fetches a single library entry by user + book ID.
 */
export async function getLibraryEntry(
  userId: string,
  bookId: string,
): Promise<LibraryEntryResult> {
  const snapshot = await getLibraryEntrySnapshot(userId, bookId);

  if (!snapshot.entry) {
    throw new LibraryEntryNotFoundError();
  }

  return snapshot.entry;
}

export async function getLibraryEntrySnapshot(
  userId: string,
  bookId: string,
): Promise<LibraryEntrySnapshotResult> {
  try {
    const entry = await findLibraryEntryWithCompat(
      { userId_bookId: { userId, bookId } },
      FULL_USER_BOOK_READ_ATTEMPT,
    );

    if (!entry) {
      return {
        entry: null,
        state: "missing",
      };
    }

    return {
      entry,
      state: entry.compatDegraded ? "degraded" : "full",
    };
  } catch (error) {
    if (isMissingUserBookSchemaError(error)) {
      return {
        entry: null,
        state: "unavailable",
      };
    }

    throw error;
  }
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

      if (isMissingUserBookSchemaError(error)) {
        throw error;
      }

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

    return userBook
      ? {
          ...userBook,
          finishedAt: null,
          compatDegraded: true,
          compatDegradedFields: [COMPAT_DEGRADED_FIELD.FINISHED_AT],
        }
      : null;
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

    return userBook
      ? {
          ...userBook,
          ownershipStatus: "UNKNOWN",
          compatDegraded: true,
          compatDegradedFields: [COMPAT_DEGRADED_FIELD.OWNERSHIP_STATUS],
        }
      : null;
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
    ? {
        ...userBook,
        ownershipStatus: "UNKNOWN",
        finishedAt: null,
        compatDegraded: true,
        compatDegradedFields: [
          COMPAT_DEGRADED_FIELD.OWNERSHIP_STATUS,
          COMPAT_DEGRADED_FIELD.FINISHED_AT,
        ],
      }
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
