import "server-only";

import { prisma } from "@/lib/prisma";
import type { UserBookWithBook } from "@/lib/types/book";
import { LibraryEntryNotFoundError } from "./errors";

/**
 * Fetches a single library entry by user + book ID.
 */
export async function getLibraryEntry(
  userId: string,
  bookId: string,
): Promise<UserBookWithBook> {
  const userBook: UserBookWithBook | null = await prisma.userBook.findUnique({
    where: { userId_bookId: { userId, bookId } },
    include: { book: true },
  });

  if (!userBook) {
    throw new LibraryEntryNotFoundError();
  }

  return userBook;
}
