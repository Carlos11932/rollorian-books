import "server-only";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidateBookCollectionPaths } from "@/lib/revalidation";
import { LibraryEntryNotFoundError } from "./errors";

/**
 * Removes a book from the user's library.
 * Uses direct delete + P2025 catch instead of findUnique pre-check (avoids TOCTOU).
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
    throw error;
  }
}
