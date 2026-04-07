import "server-only";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidateBookCollectionPaths } from "@/lib/revalidation";
import { logger } from "@/lib/logger";
import { LibraryEntryNotFoundError } from "./errors";

/**
 * Removes a book from the user's library and cleans up all related data.
 *
 * Uses an interactive transaction (not batch) for PrismaPg adapter compatibility.
 * Cleanup order:
 * 1. DonnaBookState — removes AI reading state (prevents stale state on re-add)
 * 2. BookListItem — removes from user's lists (prevents ghost entries)
 * 3. Active loans — declines pending/active loans where user is lender
 * 4. UserBook — the library entry itself
 */
export async function deleteLibraryEntry(
  userId: string,
  bookId: string,
): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Clean up Donna AI reading state for this user+book
      await tx.donnaBookState.deleteMany({
        where: { userId, bookId },
      });

      // 2. Remove book from all of this user's lists (scalar filter only)
      const userLists = await tx.bookList.findMany({
        where: { userId },
        select: { id: true },
      });

      if (userLists.length > 0) {
        await tx.bookListItem.deleteMany({
          where: {
            bookId,
            listId: { in: userLists.map((l) => l.id) },
          },
        });
      }

      // 3. Decline any active loans where this user is the lender for this book
      await tx.loan.updateMany({
        where: {
          lenderId: userId,
          bookId,
          status: { in: ["REQUESTED", "OFFERED", "ACTIVE"] },
        },
        data: { status: "DECLINED" },
      });

      // 4. Delete the library entry itself
      await tx.userBook.delete({
        where: { userId_bookId: { userId, bookId } },
      });
    });

    revalidateBookCollectionPaths(bookId);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new LibraryEntryNotFoundError();
    }
    logger.error("Failed to delete library entry", error, {
      userId,
      bookId,
    });
    throw error;
  }
}
