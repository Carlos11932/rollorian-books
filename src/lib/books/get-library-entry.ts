import "server-only";

import { prisma } from "@/lib/prisma";
import type { UserBookWithBook } from "@/lib/types/book";
import { LibraryEntryNotFoundError } from "./errors";
import { USER_BOOK_SELECT } from "./user-book-select";

/**
 * Fetches a single library entry by user + book ID.
 */
export async function getLibraryEntry(
  userId: string,
  bookId: string,
): Promise<UserBookWithBook> {
  const result = await prisma.userBook.findUnique({
    where: { userId_bookId: { userId, bookId } },
    select: USER_BOOK_SELECT,
  });

  if (!result) {
    throw new LibraryEntryNotFoundError();
  }

  return { ...result, finishedAt: null };
}
