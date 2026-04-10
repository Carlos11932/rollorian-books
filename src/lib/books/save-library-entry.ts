import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getUserBookCompatFallbackAttempts,
  getUserBookCompatAttempts,
  isRetryableUserBookCompatError,
  type UserBookCompatAttempt,
} from "@/lib/prisma-schema-compat";
import type { UserBookWithBook } from "@/lib/types/book";
import type { CreateBookInput } from "@/lib/schemas/book";
import { revalidateBookCollectionPaths } from "@/lib/revalidation";
import { DuplicateLibraryEntryError } from "./errors";
import { USER_BOOK_SELECT } from "./user-book-select";

const USER_BOOK_CREATE_SELECT = {
  id: true,
} as const;

const CREATE_WRITE_RETRY_LIMIT = 3;

type SaveLibraryEntryClient = Pick<Prisma.TransactionClient, "$queryRaw" | "book" | "userBook">;

export class OwnershipStatusCreateCompatError extends Error {
  constructor() {
    super("Ownership status updates require a database schema that includes ownershipStatus");
  }
}

export class LibraryEntryCreateConflictError extends Error {
  constructor() {
    super("Could not create this library entry because another write happened at the same time. Please retry.");
  }
}

/**
 * Saves a book to the user's library. Deduplicates by ISBN if possible,
 * creating the Book record only when no match is found.
 */
export async function saveLibraryEntry(
  userId: string,
  input: CreateBookInput,
  options: { ownershipStatusRequested?: boolean } = {},
): Promise<UserBookWithBook> {
  const { status, ownershipStatus, rating, notes, ...bookFields } = input;
  const ownershipStatusRequested = ownershipStatus !== "UNKNOWN"
    && (options.ownershipStatusRequested ?? true);

  for (let attempt = 0; attempt < CREATE_WRITE_RETRY_LIMIT; attempt += 1) {
    try {
      const userBook = await prisma.$transaction(async (tx) => {
        await acquireIsbnTransactionLocks(tx, bookFields);

        // Find existing book by any provided ISBN before creating a new row.
        let book = await findExistingBookByIsbn(tx, bookFields);

        if (await hasLogicalDuplicateLibraryEntry(tx, userId, bookFields, book?.id)) {
          throw new DuplicateLibraryEntryError();
        }

        if (!book) {
          book = await tx.book.create({ data: bookFields });
        }

        const existingUserBook = await tx.userBook.findUnique({
          where: { userId_bookId: { userId, bookId: book.id } },
          select: { id: true },
        });

        if (existingUserBook) {
          throw new DuplicateLibraryEntryError();
        }

        const initialAttempt = getUserBookCompatAttempts({
          includeOwnershipStatus: ownershipStatusRequested,
          includeFinishedAt: status === "READ",
        })[0];

        let savedUserBook: UserBookWithBook | null = null;
        let lastError: unknown;
        const attemptedCompatModes: UserBookCompatAttempt[] = initialAttempt ? [initialAttempt] : [];

        for (let index = 0; index < attemptedCompatModes.length; index += 1) {
          const compatAttempt = attemptedCompatModes[index];

          if (!compatAttempt) {
            continue;
          }

          if (isOwnershipCompatGap(ownershipStatusRequested, compatAttempt)) {
            throw new OwnershipStatusCreateCompatError();
          }

          try {
            await createUserBookWithCompat(tx, {
              attempt: compatAttempt,
              userId,
              bookId: book.id,
              status,
              ownershipStatus,
              rating,
              notes,
            });
            savedUserBook = await findSavedUserBook(tx, userId, book.id, compatAttempt);
            break;
          } catch (error) {
            lastError = error;
            if (isUniqueUserBookConflict(error)) {
              throw new DuplicateLibraryEntryError();
            }
            if (!isRetryableUserBookCompatError(error)) {
              throw error;
            }

            for (const fallbackAttempt of getUserBookCompatFallbackAttempts(compatAttempt, error)) {
              if (!hasAttempt(attemptedCompatModes, fallbackAttempt)) {
                attemptedCompatModes.push(fallbackAttempt);
              }
            }
          }
        }

        if (!savedUserBook) {
          throw lastError;
        }

        return savedUserBook;
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });

      revalidateBookCollectionPaths(userBook.bookId);

      return userBook;
    } catch (error) {
      if (!isTransactionWriteConflict(error)) {
        throw error;
      }
    }
  }

  throw new LibraryEntryCreateConflictError();
}

async function acquireIsbnTransactionLocks(
  tx: SaveLibraryEntryClient,
  bookFields: Omit<CreateBookInput, "status" | "ownershipStatus" | "rating" | "notes">,
): Promise<void> {
  const identifiers = getBookIdentifierValues(bookFields).sort();

  for (const identifier of identifiers) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('library-book-isbn'), hashtext(${identifier}))`;
  }
}

async function createUserBookWithCompat(
  tx: SaveLibraryEntryClient,
  {
    attempt,
    userId,
    bookId,
    status,
    ownershipStatus,
    rating,
    notes,
  }: {
  attempt: UserBookCompatAttempt;
  userId: string;
  bookId: string;
  status: CreateBookInput["status"];
  ownershipStatus: CreateBookInput["ownershipStatus"];
  rating: CreateBookInput["rating"];
  notes: CreateBookInput["notes"];
}): Promise<void> {
  if (attempt.includeOwnershipStatus) {
    await tx.userBook.create({
      data: {
        userId,
        bookId,
        status,
        ownershipStatus,
        ...(attempt.includeFinishedAt ? { finishedAt: new Date() } : {}),
        ...(rating !== undefined ? { rating } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
      select: USER_BOOK_CREATE_SELECT,
    });
    return;
  }

  await tx.userBook.create({
    data: {
      user: { connect: { id: userId } },
      book: { connect: { id: bookId } },
      status,
      ...(attempt.includeFinishedAt ? { finishedAt: new Date() } : {}),
      ...(rating !== undefined ? { rating } : {}),
      ...(notes !== undefined ? { notes } : {}),
    },
    select: USER_BOOK_CREATE_SELECT,
  });
}

async function hasLogicalDuplicateLibraryEntry(
  tx: SaveLibraryEntryClient,
  userId: string,
  bookFields: Omit<CreateBookInput, "status" | "ownershipStatus" | "rating" | "notes">,
  excludedBookId?: string,
): Promise<boolean> {
  const isbnClauses = getBookIdentifierValues(bookFields)
    .map((value) => ({ book: { OR: [{ isbn13: value }, { isbn10: value }] } }));

  if (isbnClauses.length === 0) {
    return false;
  }

  const existingUserBook = await tx.userBook.findFirst({
    where: {
      userId,
      ...(excludedBookId ? { bookId: { not: excludedBookId } } : {}),
      OR: isbnClauses,
    },
    select: { id: true },
  });

  return existingUserBook !== null;
}

async function findExistingBookByIsbn(
  tx: SaveLibraryEntryClient,
  bookFields: Omit<CreateBookInput, "status" | "ownershipStatus" | "rating" | "notes">,
) {
  const identifiers = getBookIdentifierValues(bookFields);

  if (identifiers.length === 0) {
    return null;
  }

  return tx.book.findFirst({
    where: {
      OR: identifiers.flatMap((identifier) => [{ isbn13: identifier }, { isbn10: identifier }]),
    },
  });
}

function getBookIdentifierValues(
  bookFields: Omit<CreateBookInput, "status" | "ownershipStatus" | "rating" | "notes">,
): string[] {
  return [...new Set([bookFields.isbn13, bookFields.isbn10]
    .filter((value): value is string => typeof value === "string" && value.length > 0))];
}

async function findSavedUserBook(
  tx: SaveLibraryEntryClient,
  userId: string,
  bookId: string,
  initialAttempt: UserBookCompatAttempt,
): Promise<UserBookWithBook> {
  const attempts: UserBookCompatAttempt[] = [initialAttempt];
  let lastError: unknown;

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];

    if (!attempt) {
      continue;
    }

    try {
      return await readSavedUserBook(tx, userId, bookId, attempt);
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

async function readSavedUserBook(
  tx: SaveLibraryEntryClient,
  userId: string,
  bookId: string,
  attempt: UserBookCompatAttempt,
): Promise<UserBookWithBook> {
  if (attempt.includeOwnershipStatus && attempt.includeFinishedAt) {
    return tx.userBook.findUniqueOrThrow({
      where: { userId_bookId: { userId, bookId } },
      select: {
        ...USER_BOOK_SELECT,
        finishedAt: true,
      },
    });
  }

  if (attempt.includeOwnershipStatus) {
    const userBook = await tx.userBook.findUniqueOrThrow({
      where: { userId_bookId: { userId, bookId } },
      select: USER_BOOK_SELECT,
    });

    return {
      ...userBook,
      finishedAt: null,
    };
  }

  if (attempt.includeFinishedAt) {
    const userBook = await tx.userBook.findUniqueOrThrow({
      where: { userId_bookId: { userId, bookId } },
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

    return {
      ...userBook,
      ownershipStatus: "UNKNOWN",
    };
  }

  const userBook = await tx.userBook.findUniqueOrThrow({
    where: { userId_bookId: { userId, bookId } },
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

  return {
    ...userBook,
    ownershipStatus: "UNKNOWN",
    finishedAt: null,
  };
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

function isUniqueUserBookConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isTransactionWriteConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

function isOwnershipCompatGap(
  ownershipStatusRequested: boolean,
  attempt: UserBookCompatAttempt,
): boolean {
  return ownershipStatusRequested && !attempt.includeOwnershipStatus;
}
