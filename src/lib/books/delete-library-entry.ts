import "server-only";

import { prisma } from "@/lib/prisma";
import { revalidateBookCollectionPaths } from "@/lib/revalidation";
import { logger } from "@/lib/logger";
import { LibraryEntryNotFoundError } from "./errors";

/**
 * Removes a book from the user's library and cleans up related data.
 *
 * Uses `deleteMany` instead of `delete` to avoid Prisma 7 schema drift:
 * `.delete()` does `RETURNING *` internally, which fails with P2022 when
 * the `finishedAt` column is missing from the production database.
 * `.deleteMany()` only returns `{ count }` — no column reads, no drift.
 *
 * See `src/lib/books/user-book-select.ts` for the same pattern on queries.
 */
export async function deleteLibraryEntry(
  userId: string,
  bookId: string,
): Promise<void> {
  try {
    // Best-effort: clean up Donna AI reading state (table may not exist)
    await prisma.donnaBookState.deleteMany({
      where: { userId, bookId },
    }).catch(() => {
      // DonnaBookState migration may not be applied yet — safe to skip
    });

    // Remove book from user's lists (prevents ghost entries)
    const userLists = await prisma.bookList.findMany({
      where: { userId },
      select: { id: true },
    });

    if (userLists.length > 0) {
      await prisma.bookListItem.deleteMany({
        where: {
          bookId,
          listId: { in: userLists.map((l) => l.id) },
        },
      });
    }

    // Decline active loans where user is lender
    await prisma.loan.updateMany({
      where: {
        lenderId: userId,
        bookId,
        status: { in: ["REQUESTED", "OFFERED", "ACTIVE"] },
      },
      data: { status: "DECLINED" },
    });

    // Delete the library entry — deleteMany avoids RETURNING * schema drift
    const result = await prisma.userBook.deleteMany({
      where: { userId, bookId },
    });

    if (result.count === 0) {
      throw new LibraryEntryNotFoundError();
    }

    revalidateBookCollectionPaths(bookId);
  } catch (error) {
    if (error instanceof LibraryEntryNotFoundError) {
      throw error;
    }
    logger.error("Failed to delete library entry", error, {
      userId,
      bookId,
    });
    throw error;
  }
}
