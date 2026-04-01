import "server-only";

import { prisma } from "@/lib/prisma";
import { isMissingFinishedAtError } from "@/lib/prisma-schema-compat";
import { Prisma } from "@prisma/client";
import type { UserBookWithBook } from "@/lib/types/book";
import type { UpdateBookInput } from "@/lib/schemas/book";
import { revalidateBookCollectionPaths } from "@/lib/revalidation";
import { LibraryEntryNotFoundError } from "./errors";
import { USER_BOOK_SELECT } from "./user-book-select";

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

    let created;

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

      created = transitionedToRead.count > 0
        ? await prisma.userBook.findUniqueOrThrow({
            where,
            select: USER_BOOK_SELECT,
          })
        : await prisma.userBook.update({
            where,
            data: {
              ...rest,
              status,
            },
            select: USER_BOOK_SELECT,
          });
    } else {
      created = await prisma.userBook.update({
        where,
        data: status === undefined
          ? rest
          : {
              ...rest,
              status,
              finishedAt: null,
            },
        select: USER_BOOK_SELECT,
      });
    }

    revalidateBookCollectionPaths(bookId);

    return { ...created, finishedAt: null };
  } catch (error) {
    if (isMissingFinishedAtError(error)) {
      const { status, ...rest } = input;
      const legacyCreated = await prisma.userBook.update({
        where: { userId_bookId: { userId, bookId } },
        data: status === undefined ? rest : { ...rest, status },
        select: USER_BOOK_SELECT,
      });

      revalidateBookCollectionPaths(bookId);

      return { ...legacyCreated, finishedAt: null };
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new LibraryEntryNotFoundError();
    }
    throw error;
  }
}
