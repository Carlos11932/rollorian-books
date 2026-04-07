import "server-only";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidateBookCollectionPaths } from "@/lib/revalidation";
import { logger } from "@/lib/logger";
import { LibraryEntryNotFoundError } from "./errors";

/**
 * Removes a book from the user's library and cleans up all related data.
 *
 * Uses an interactive transaction for PrismaPg adapter compatibility.
 * DonnaBookState cleanup is best-effort outside the transaction because
 * the Donna migration may not have been applied to the database yet.
 */
export async function deleteLibraryEntry(
  userId: string,
  bookId: string,
): Promise<void> {
  // Best-effort: clean up Donna AI reading state (table may not exist yet)
  try {
    await prisma.donnaBookState.deleteMany({
      where: { userId, bookId },
    });
  } catch {
    // Table may not exist if Donna migration hasn't been applied — safe to skip
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Remove book from all of this user's lists (scalar filter only)
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

      // 2. Decline any active loans where this user is the lender for this book
      await tx.loan.updateMany({
        where: {
          lenderId: userId,
          bookId,
          status: { in: ["REQUESTED", "OFFERED", "ACTIVE"] },
        },
        data: { status: "DECLINED" },
      });

      // 3. Delete the library entry itself
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
