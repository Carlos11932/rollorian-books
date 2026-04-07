import "server-only";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidateBookCollectionPaths } from "@/lib/revalidation";
import { logger } from "@/lib/logger";
import { LibraryEntryNotFoundError } from "./errors";

/**
 * Removes a book from the user's library.
 * Related data cleanup (lists, loans, donna state) will be added once
 * the root cause of the 500 error is identified.
 */
export async function deleteLibraryEntry(
  userId: string,
  bookId: string,
): Promise<void> {
  try {
    await prisma.userBook.delete({
      where: { userId_bookId: { userId, bookId } },
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
