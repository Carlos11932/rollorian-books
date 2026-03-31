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
    const { status, ...rest } = input;
    const where = { userId_bookId: { userId, bookId } };

    let userBook: UserBookWithBook;

    if (status === "READ") {
      const transitionedToRead = await prisma.userBook.updateMany({
        where: {
          userId,
          bookId,
          status: { not: "READ" },
        },
        data: {
          ...rest,
          status,
          finishedAt: new Date(),
        },
      });

      userBook = transitionedToRead.count > 0
        ? await prisma.userBook.findUniqueOrThrow({
            where,
            include: { book: true },
          })
        : await prisma.userBook.update({
            where,
            data: {
              ...rest,
              status,
            },
            include: { book: true },
          });
    } else {
      userBook = await prisma.userBook.update({
        where,
        data: status === undefined
          ? rest
          : {
              ...rest,
              status,
              finishedAt: null,
            },
        include: { book: true },
      });
    }

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
