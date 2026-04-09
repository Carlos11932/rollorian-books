import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";
import { BOOK_STATUS_VALUES, type BookStatus, OWNERSHIP_STATUS_VALUES, type OwnershipStatus } from "@/lib/types/book";
import { revalidateBookCollectionPaths } from "@/lib/revalidation";
import { logger } from "@/lib/logger";

const batchUpdateSchema = z.object({
  bookIds: z.array(z.string().min(1)).min(1).max(100),
  status: z.enum(BOOK_STATUS_VALUES as [BookStatus, ...BookStatus[]]).optional(),
  ownershipStatus: z.enum(OWNERSHIP_STATUS_VALUES as [OwnershipStatus, ...OwnershipStatus[]]).optional(),
}).refine(
  (data) => data.status !== undefined || data.ownershipStatus !== undefined,
  { error: "At least one of 'status' or 'ownershipStatus' must be provided" },
);

/**
 * PATCH /api/books/batch
 *
 * Updates the status of multiple books at once for the authenticated user.
 * Only updates UserBook rows that belong to the caller.
 */
export async function PATCH(request: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const result = batchUpdateSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        { error: "Invalid request", details: result.error.flatten() },
        { status: 400 },
      );
    }

    const { bookIds, status, ownershipStatus } = result.data;

    const updated = await prisma.userBook.updateMany({
      where: {
        userId,
        bookId: { in: bookIds },
      },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(status === "READ" ? { finishedAt: new Date() } : {}),
        ...(ownershipStatus !== undefined ? { ownershipStatus } : {}),
      },
    });

    // Revalidate library paths
    for (const bookId of bookIds) {
      revalidateBookCollectionPaths(bookId);
    }

    return Response.json({
      updated: updated.count,
      ...(status !== undefined ? { status } : {}),
      ...(ownershipStatus !== undefined ? { ownershipStatus } : {}),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Request failed", error, { endpoint: "PATCH /api/books/batch" });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
