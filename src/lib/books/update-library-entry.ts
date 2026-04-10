import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getUserBookCompatFallbackAttempts,
  isRetryableUserBookCompatError,
  type UserBookCompatAttempt,
} from "@/lib/prisma-schema-compat";
import type { BookStatus, OwnershipStatus, UserBookWithBook } from "@/lib/types/book";
import type { UpdateBookInput } from "@/lib/schemas/book";
import { revalidateBookCollectionPaths } from "@/lib/revalidation";
import { LibraryEntryNotFoundError } from "./errors";
import { USER_BOOK_SELECT } from "./user-book-select";

export class OwnershipStatusSchemaCompatError extends Error {
  constructor() {
    super("Ownership status updates require a database schema that includes ownershipStatus");
  }
}

export class LibraryEntryWriteConflictError extends Error {
  constructor() {
    super("Could not update this library entry because another update happened at the same time. Please retry.");
  }
}

export class EmptyLibraryEntryUpdateError extends Error {
  constructor() {
    super("At least one field must be provided");
  }
}

const FULL_USER_BOOK_READ_ATTEMPT: UserBookCompatAttempt = {
  includeOwnershipStatus: true,
  includeFinishedAt: true,
};

const SERIALIZABLE_RETRY_LIMIT = 4;

class ReadStatusSnapshotRetryError extends Error {}

type UserBookClient = Pick<Prisma.TransactionClient, "userBook">;
type UserBookSnapshot = {
  status: BookStatus;
  rating: number | null;
  notes: string | null;
  ownershipStatus?: OwnershipStatus;
  finishedAt?: Date | null;
};

/**
 * Updates a user's library entry (status, rating, notes).
 * Uses serializable guarded updates so concurrent writes cannot silently overwrite each other.
 */
export async function updateLibraryEntry(
  userId: string,
  bookId: string,
  input: UpdateBookInput,
): Promise<UserBookWithBook> {
  if (isEmptyUpdateInput(input)) {
    throw new EmptyLibraryEntryUpdateError();
  }

  const where = { userId_bookId: { userId, bookId } };

  for (let attempt = 0; attempt < SERIALIZABLE_RETRY_LIMIT; attempt += 1) {
    try {
      const compatAttempts: UserBookCompatAttempt[] = [{
        includeOwnershipStatus: input.ownershipStatus !== undefined,
        includeFinishedAt: input.status !== undefined,
      }];

      const updated = await prisma.$transaction(
        (tx) => updateUserBookWithCompat(tx, where, userId, bookId, input, compatAttempts),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      revalidateBookCollectionPaths(bookId);

      return updated;
    } catch (error) {
      if (error instanceof ReadStatusSnapshotRetryError) {
        continue;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === "P2025"
      ) {
        throw new LibraryEntryNotFoundError();
      }

      if (!isTransactionWriteConflict(error)) {
        throw error;
      }
    }
  }

  throw new LibraryEntryWriteConflictError();
}

async function updateUserBookWithCompat(
  client: UserBookClient,
  where: { userId_bookId: { userId: string; bookId: string } },
  userId: string,
  bookId: string,
  input: UpdateBookInput,
  compatAttempts: UserBookCompatAttempt[],
): Promise<UserBookWithBook> {
  const attempts = [...compatAttempts];
  let lastError: unknown;

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];

    if (!attempt) {
      continue;
    }

    try {
      return await runUserBookUpdateAttempt(client, where, userId, bookId, input, attempt);
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

async function runUserBookUpdateAttempt(
  client: UserBookClient,
  where: { userId_bookId: { userId: string; bookId: string } },
  userId: string,
  bookId: string,
  input: UpdateBookInput,
  attempt: UserBookCompatAttempt,
): Promise<UserBookWithBook> {
  if (isOwnershipCompatGap(input, attempt)) {
    throw new OwnershipStatusSchemaCompatError();
  }

  const current = await readCurrentSnapshot(client, where, attempt);
  const data = buildCompatibleUpdateData(input, attempt, current.status !== "READ");
  const updated = await client.userBook.updateMany({
    where: buildGuardedUpdateWhere({ userId, bookId, current, attempt }),
    data,
  });

  if (updated.count === 0) {
    throw new ReadStatusSnapshotRetryError();
  }

  return findUpdatedUserBook(client, where, FULL_USER_BOOK_READ_ATTEMPT);
}

async function readCurrentSnapshot(
  client: UserBookClient,
  where: { userId_bookId: { userId: string; bookId: string } },
  attempt: UserBookCompatAttempt,
): Promise<UserBookSnapshot> {
  return client.userBook.findUniqueOrThrow({
    where,
    select: {
      status: true,
      rating: true,
      notes: true,
      ...(attempt.includeOwnershipStatus ? { ownershipStatus: true } : {}),
      ...(attempt.includeFinishedAt ? { finishedAt: true } : {}),
    },
  });
}

function buildGuardedUpdateWhere({
  userId,
  bookId,
  current,
  attempt,
}: {
  userId: string;
  bookId: string;
  current: UserBookSnapshot;
  attempt: UserBookCompatAttempt;
}): Prisma.UserBookWhereInput {
  return {
    userId,
    bookId,
    status: current.status,
    rating: current.rating,
    notes: current.notes,
    ...(attempt.includeOwnershipStatus ? { ownershipStatus: current.ownershipStatus } : {}),
    ...(attempt.includeFinishedAt ? { finishedAt: current.finishedAt ?? null } : {}),
  };
}

function buildCompatibleUpdateData(
  input: UpdateBookInput,
  attempt: UserBookCompatAttempt,
  includeReadTransitionFinishedAt: boolean,
): Prisma.UserBookUpdateInput {
  const data: Prisma.UserBookUpdateInput = {};

  if (input.status !== undefined) {
    data.status = input.status;
    if (
      attempt.includeFinishedAt
      && (input.status !== "READ" || includeReadTransitionFinishedAt)
    ) {
      data.finishedAt = input.status === "READ" ? new Date() : null;
    }
  }

  if (attempt.includeOwnershipStatus && input.ownershipStatus !== undefined) {
    data.ownershipStatus = input.ownershipStatus;
  }

  if (input.rating !== undefined) {
    data.rating = input.rating;
  }

  if (input.notes !== undefined) {
    data.notes = input.notes;
  }

  return data;
}

async function findUpdatedUserBook(
  client: UserBookClient,
  where: { userId_bookId: { userId: string; bookId: string } },
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
      return await readUpdatedUserBook(client, where, attempt);
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

async function readUpdatedUserBook(
  client: UserBookClient,
  where: { userId_bookId: { userId: string; bookId: string } },
  attempt: UserBookCompatAttempt,
): Promise<UserBookWithBook> {
  if (!attempt.includeOwnershipStatus && !attempt.includeFinishedAt) {
    const updated = await client.userBook.findUniqueOrThrow({
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

    return { ...updated, ownershipStatus: "UNKNOWN", finishedAt: null };
  }

  if (!attempt.includeOwnershipStatus) {
    const updated = await client.userBook.findUniqueOrThrow({
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

    return { ...updated, ownershipStatus: "UNKNOWN" };
  }

  if (!attempt.includeFinishedAt) {
    const updated = await client.userBook.findUniqueOrThrow({
      where,
      select: USER_BOOK_SELECT,
    });

    return { ...updated, finishedAt: null };
  }

  const updated = await client.userBook.findUniqueOrThrow({
    where,
    select: {
      ...USER_BOOK_SELECT,
      finishedAt: true,
    },
  });

  return updated;
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

function isOwnershipCompatGap(
  input: UpdateBookInput,
  attempt: UserBookCompatAttempt,
): boolean {
  return input.ownershipStatus !== undefined && !attempt.includeOwnershipStatus;
}

function isEmptyUpdateInput(input: UpdateBookInput): boolean {
  return (
    input.status === undefined
    && input.ownershipStatus === undefined
    && input.rating === undefined
    && input.notes === undefined
  );
}

function isTransactionWriteConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}
