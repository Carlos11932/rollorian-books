import "server-only";

import { prisma } from "@/lib/prisma";
import { revalidateBookCollectionPaths } from "@/lib/revalidation";
import { LibraryEntryNotFoundError } from "./errors";

/**
 * Removes a book from the user's library and cleans up related data.
 *
 * Uses `deleteMany` instead of `delete` to avoid Prisma 7 schema drift:
 * `.delete()` does `RETURNING *` internally, which fails with P2022 when
 * the `finishedAt` column is missing from the production database.
 * `.deleteMany()` only returns `{ count }` — no column reads, no drift.
 *
 * See `src/lib/books/user-book-select.ts` for the same pattern on queries.
 * Related data cleanup is best-effort — tables may not exist (pending migrations).
 */
export async function deleteLibraryEntry(
  userId: string,
  bookId: string,
): Promise<void> {
  // Multiple tables may not exist in production yet. Each cleanup is best-effort
  // so a missing table does not block the library entry delete itself.
  await cleanupRelatedData(userId, bookId);

  const result = await prisma.userBook.deleteMany({
    where: { userId, bookId },
  });
  if (result.count === 0) {
    throw new LibraryEntryNotFoundError();
  }

  revalidateBookCollectionPaths(bookId);
}

async function cleanupRelatedData(userId: string, bookId: string): Promise<void> {
  await prisma.donnaBookState
    .deleteMany({ where: { userId, bookId } })
    .catch(() => {});

  await prisma.bookList
    .findMany({ where: { userId }, select: { id: true } })
    .then(async (lists) => {
      if (lists.length > 0) {
        await prisma.bookListItem.deleteMany({
          where: { bookId, listId: { in: lists.map((list) => list.id) } },
        });
      }
    })
    .catch(() => {});

  await prisma.loan
    .updateMany({
      where: {
        lenderId: userId,
        bookId,
        status: { in: ["REQUESTED", "OFFERED", "ACTIVE"] },
      },
      data: { status: "DECLINED" },
    })
    .catch(() => {});
}
