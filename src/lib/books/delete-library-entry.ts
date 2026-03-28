import "server-only";

import { prisma } from "@/lib/prisma";
import { revalidateBookCollectionPaths } from "@/lib/revalidation";
import { LibraryEntryNotFoundError } from "./errors";

/**
 * Removes a book from the user's library.
 */
export async function deleteLibraryEntry(
  userId: string,
  bookId: string,
): Promise<void> {
  const existing = await prisma.userBook.findUnique({
    where: { userId_bookId: { userId, bookId } },
  });
  if (!existing) {
    throw new LibraryEntryNotFoundError();
  }

  await prisma.userBook.delete({
    where: { userId_bookId: { userId, bookId } },
  });

  revalidateBookCollectionPaths(bookId);
}
