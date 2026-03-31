import "server-only";

import { prisma } from "@/lib/prisma";
import type { UserBookWithBook } from "@/lib/types/book";
import type { CreateBookInput } from "@/lib/schemas/book";
import { revalidateBookCollectionPaths } from "@/lib/revalidation";
import { DuplicateLibraryEntryError } from "./errors";

/**
 * Saves a book to the user's library. Deduplicates by ISBN if possible,
 * creating the Book record only when no match is found.
 */
export async function saveLibraryEntry(
  userId: string,
  input: CreateBookInput,
): Promise<UserBookWithBook> {
  const { status, rating, notes, ...bookFields } = input;

  // Find existing book by ISBN or create a new one
  let book = bookFields.isbn13
    ? await prisma.book.findFirst({ where: { isbn13: bookFields.isbn13 } })
    : bookFields.isbn10
      ? await prisma.book.findFirst({ where: { isbn10: bookFields.isbn10 } })
      : null;

  if (!book) {
    book = await prisma.book.create({ data: bookFields });
  }

  // Check if user already has this book
  const existingUserBook = await prisma.userBook.findUnique({
    where: { userId_bookId: { userId, bookId: book.id } },
  });

  if (existingUserBook) {
    throw new DuplicateLibraryEntryError();
  }

  const userBook: UserBookWithBook = await prisma.userBook.create({
    data: {
      userId,
      bookId: book.id,
      status,
      ...(status === "READ" ? { finishedAt: new Date() } : {}),
      ...(rating !== undefined ? { rating } : {}),
      ...(notes !== undefined ? { notes } : {}),
    },
    include: { book: true },
  });

  revalidateBookCollectionPaths(book.id);

  return userBook;
}
