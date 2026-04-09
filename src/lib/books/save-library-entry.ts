import "server-only";

import { prisma } from "@/lib/prisma";
import { isMissingFinishedAtError } from "@/lib/prisma-schema-compat";
import type { UserBookWithBook } from "@/lib/types/book";
import type { CreateBookInput } from "@/lib/schemas/book";
import { revalidateBookCollectionPaths } from "@/lib/revalidation";
import { DuplicateLibraryEntryError } from "./errors";
import { USER_BOOK_SELECT } from "./user-book-select";

/**
 * Saves a book to the user's library. Deduplicates by ISBN if possible,
 * creating the Book record only when no match is found.
 */
export async function saveLibraryEntry(
  userId: string,
  input: CreateBookInput,
): Promise<UserBookWithBook> {
  const { status, ownershipStatus, rating, notes, ...bookFields } = input;

  // Find existing book by ISBN or create a new one
  let book = bookFields.isbn13
    ? await prisma.book.findFirst({ where: { isbn13: bookFields.isbn13 } })
    : bookFields.isbn10
      ? await prisma.book.findFirst({ where: { isbn10: bookFields.isbn10 } })
      : null;

  if (!book) {
    book = await prisma.book.create({ data: bookFields });
  }

  // Check if user already has this book (select only id to avoid schema drift)
  const existingUserBook = await prisma.userBook.findUnique({
    where: { userId_bookId: { userId, bookId: book.id } },
    select: { id: true },
  });

  if (existingUserBook) {
    throw new DuplicateLibraryEntryError();
  }

  let created;

  try {
    created = await prisma.userBook.create({
      data: {
        userId,
        bookId: book.id,
        status,
        ownershipStatus,
        ...(status === "READ" ? { finishedAt: new Date() } : {}),
        ...(rating !== undefined ? { rating } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
      select: USER_BOOK_SELECT,
    });
  } catch (error) {
    if (!isMissingFinishedAtError(error)) {
      throw error;
    }

    created = await prisma.userBook.create({
      data: {
        userId,
        bookId: book.id,
        status,
        ownershipStatus,
        ...(rating !== undefined ? { rating } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
      select: USER_BOOK_SELECT,
    });
  }

  const userBook: UserBookWithBook = { ...created, finishedAt: null };

  revalidateBookCollectionPaths(book.id);

  return userBook;
}
