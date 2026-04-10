import "server-only";

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";
import {
  getUserBookCompatFallbackAttempts,
  isRetryableUserBookCompatError,
  type UserBookCompatAttempt,
} from "@/lib/prisma-schema-compat";
import { BOOK_STATUS_VALUES, type BookStatus, OWNERSHIP_STATUS_VALUES, type OwnershipStatus } from "@/lib/types/book";
import { revalidateBookCollectionPaths } from "@/lib/revalidation";
import { logger } from "@/lib/logger";
import { LibraryEntryWriteConflictError } from "@/lib/books/update-library-entry";

class OwnershipStatusBatchCompatError extends Error {
  constructor() {
    super("Ownership status updates require a database schema that includes ownershipStatus");
  }
}

function isLibraryEntryWriteConflictError(error: unknown): boolean {
  return (
    error instanceof LibraryEntryWriteConflictError
    || (error instanceof Error
      && error.message === "Could not update this library entry because another update happened at the same time. Please retry.")
  );
}

const batchUpdateSchema = z.object({
  bookIds: z.array(z.string().min(1)).min(1).max(100),
  status: z.enum(BOOK_STATUS_VALUES as [BookStatus, ...BookStatus[]]).optional(),
  ownershipStatus: z.enum(OWNERSHIP_STATUS_VALUES as [OwnershipStatus, ...OwnershipStatus[]]).optional(),
}).refine(
  (data) => data.status !== undefined || data.ownershipStatus !== undefined,
  { error: "At least one of 'status' or 'ownershipStatus' must be provided" },
);

const SERIALIZABLE_RETRY_LIMIT = 4;

class ReadStatusSnapshotRetryError extends Error {}

type UserBookBatchSnapshot = {
  status: BookStatus;
  ownershipStatus?: OwnershipStatus;
};

/**
 * PATCH /api/books/batch
 *
 * Updates the status and/or ownership of multiple books at once for the authenticated user.
 * Only updates UserBook rows that belong to the caller.
 */
export async function PATCH(request: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const body: unknown = await request.json();
    const result = batchUpdateSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        { error: "Invalid request", details: result.error.flatten() },
        { status: 400 },
      );
    }

    const bookIds = [...new Set(result.data.bookIds)].sort();
    const { status, ownershipStatus } = result.data;

    const updated = await updateManyWithCompat({
      userId,
      bookIds,
      status,
      ownershipStatus,
    });

    // Revalidate library paths
    for (const bookId of bookIds) {
      revalidateBookCollectionPaths(bookId);
    }

    return Response.json({
      updated: updated.count,
      ...(updated.status !== undefined ? { status: updated.status } : {}),
      ...(updated.ownershipStatus !== undefined ? { ownershipStatus: updated.ownershipStatus } : {}),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof OwnershipStatusBatchCompatError) {
      return Response.json(
        {
          error: error.message,
          code: "OWNERSHIP_STATUS_UNSUPPORTED",
        },
        { status: 409 },
      );
    }
    if (isLibraryEntryWriteConflictError(error)) {
      return Response.json(
        {
          error: "Could not update this library entry because another update happened at the same time. Please retry.",
          code: "CONCURRENT_UPDATE_CONFLICT",
        },
        { status: 409 },
      );
    }
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }
    logger.error("Request failed", error, { endpoint: "PATCH /api/books/batch" });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function updateManyWithCompat({
  userId,
  bookIds,
  status,
  ownershipStatus,
}: {
  userId: string;
  bookIds: string[];
  status?: BookStatus;
  ownershipStatus?: OwnershipStatus;
}): Promise<{
  count: number;
  status?: BookStatus;
  ownershipStatus?: OwnershipStatus;
}> {
  const attempts: UserBookCompatAttempt[] = [{
    includeOwnershipStatus: ownershipStatus !== undefined,
    includeFinishedAt: status !== undefined,
  }];

  let lastError: unknown;

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];

    if (!attempt) {
      continue;
    }

    try {
      if (isOwnershipCompatGap({ ownershipStatus, attempt })) {
        throw new OwnershipStatusBatchCompatError();
      }

      const result = await updateManyBooks({
        userId,
        bookIds,
        status,
        ownershipStatus,
        attempt,
      });

      return {
        count: result.count,
        ...(status !== undefined ? { status } : {}),
        ...(attempt.includeOwnershipStatus && ownershipStatus !== undefined ? { ownershipStatus } : {}),
      };
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

async function updateManyBooks({
  userId,
  bookIds,
  status,
  ownershipStatus,
  attempt,
}: {
  userId: string;
  bookIds: string[];
  status?: BookStatus;
  ownershipStatus?: OwnershipStatus;
  attempt: UserBookCompatAttempt;
}): Promise<{ count: number }> {
  for (let retries = 0; retries < SERIALIZABLE_RETRY_LIMIT; retries += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        let count = 0;

        for (const bookId of bookIds) {
          count += await updateSingleBook(tx, {
            userId,
            bookId,
            status,
            ownershipStatus,
            attempt,
          });
        }

        return { count };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (error instanceof ReadStatusSnapshotRetryError) {
        continue;
      }

      if (!isTransactionWriteConflict(error)) {
        throw error;
      }
    }
  }

  throw new LibraryEntryWriteConflictError();
}

async function updateSingleBook(
  tx: Pick<Prisma.TransactionClient, "userBook">,
  {
    userId,
    bookId,
    status,
    ownershipStatus,
    attempt,
  }: {
    userId: string;
    bookId: string;
    status?: BookStatus;
    ownershipStatus?: OwnershipStatus;
    attempt: UserBookCompatAttempt;
  },
): Promise<number> {
  const current = await tx.userBook.findUnique({
    where: { userId_bookId: { userId, bookId } },
    select: {
      status: true,
      ...(attempt.includeOwnershipStatus ? { ownershipStatus: true } : {}),
    },
  });

  if (!current) {
    return 0;
  }

  const result = await tx.userBook.updateMany({
    where: buildGuardedBatchWhere({ userId, bookId, current, attempt }),
    data: {
      ...(status !== undefined ? { status } : {}),
      ...(status !== undefined && attempt.includeFinishedAt
        ? buildFinishedAtStatusUpdate(status, current.status)
        : {}),
      ...(attempt.includeOwnershipStatus && ownershipStatus !== undefined ? { ownershipStatus } : {}),
    },
  });

  if (result.count === 0) {
    throw new ReadStatusSnapshotRetryError();
  }

  return 1;
}

function buildGuardedBatchWhere({
  userId,
  bookId,
  current,
  attempt,
}: {
  userId: string;
  bookId: string;
  current: UserBookBatchSnapshot;
  attempt: UserBookCompatAttempt;
}): Prisma.UserBookWhereInput {
  return {
    userId,
    bookId,
    status: current.status,
    ...(attempt.includeOwnershipStatus ? { ownershipStatus: current.ownershipStatus } : {}),
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

function isOwnershipCompatGap({
  ownershipStatus,
  attempt,
}: {
  ownershipStatus?: OwnershipStatus;
  attempt: UserBookCompatAttempt;
}): boolean {
  return ownershipStatus !== undefined && !attempt.includeOwnershipStatus;
}

function buildFinishedAtStatusUpdate(
  nextStatus: BookStatus,
  currentStatus: BookStatus,
): Prisma.UserBookUpdateManyMutationInput {
  if (nextStatus === "READ") {
    return currentStatus === "READ" ? {} : { finishedAt: new Date() };
  }

  return { finishedAt: null };
}

function isTransactionWriteConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}
