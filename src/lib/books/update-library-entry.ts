import "server-only";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { UserBookWithBook } from "@/lib/types/book";
import type { UpdateBookInput } from "@/lib/schemas/book";
import { revalidateBookCollectionPaths } from "@/lib/revalidation";
import { LibraryEntryNotFoundError } from "./errors";

/**
 * Updates a user's library entry (status, rating, notes).
 * Uses direct update + P2025 catch instead of findUnique pre-check (avoids TOCTOU).
 */
export async function updateLibraryEntry(
  userId: string,
  bookId: string,
  input: UpdateBookInput,
): Promise<UserBookWithBook> {
  try {
    const userBook: UserBookWithBook = await prisma.userBook.update({
      where: { userId_bookId: { userId, bookId } },
      data: input,
      include: { book: true },
    });

    revalidateBookCollectionPaths(bookId);

    return userBook;
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
