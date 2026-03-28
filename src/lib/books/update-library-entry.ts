import "server-only";

import { prisma } from "@/lib/prisma";
import type { UserBookWithBook } from "@/lib/types/book";
import type { UpdateBookInput } from "@/lib/schemas/book";
import { revalidateBookCollectionPaths } from "@/lib/revalidation";
import { LibraryEntryNotFoundError } from "./errors";

/**
 * Updates a user's library entry (status, rating, notes).
 */
export async function updateLibraryEntry(
  userId: string,
  bookId: string,
  input: UpdateBookInput,
): Promise<UserBookWithBook> {
  const existing = await prisma.userBook.findUnique({
    where: { userId_bookId: { userId, bookId } },
  });
  if (!existing) {
    throw new LibraryEntryNotFoundError();
  }

  const userBook: UserBookWithBook = await prisma.userBook.update({
    where: { userId_bookId: { userId, bookId } },
    data: input,
    include: { book: true },
  });

  revalidateBookCollectionPaths(bookId);

  return userBook;
}
