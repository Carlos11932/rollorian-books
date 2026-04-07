import "server-only";

import { prisma } from "@/lib/prisma";
import { revalidateBookCollectionPaths } from "@/lib/revalidation";
import { logger } from "@/lib/logger";
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
 */
export async function deleteLibraryEntry(
  userId: string,
  bookId: string,
): Promise<void> {
  // ── Best-effort cleanup ──────────────────────────────────────────────
  // Multiple tables may not exist in production (pending migrations).
  // Each cleanup is wrapped individually so failures don't block the delete.

  await cleanupRelatedData(userId, bookId);

  // ── Essential: delete the library entry ──────────────────────────────
  // Uses deleteMany to avoid Prisma 7 RETURNING * schema drift (P2022).
  const result = await prisma.userBook.deleteMany({
    where: { userId, bookId },
  });

  if (result.count === 0) {
    throw new LibraryEntryNotFoundError();
  }

  revalidateBookCollectionPaths(bookId);
}

/**
 * Best-effort cleanup of related data. Each operation catches its own errors
 * because the underlying tables may not exist yet (pending migrations for
 * DonnaBookState, Loan, BookList, etc.).
 */
async function cleanupRelatedData(
  userId: string,
  bookId: string,
): Promise<void> {
  // Donna AI reading state
  await prisma.donnaBookState
    .deleteMany({ where: { userId, bookId } })
    .catch(() => { /* table may not exist */ });

  // Book list items
  await prisma.bookList
    .findMany({ where: { userId }, select: { id: true } })
    .then(async (lists) => {
      if (lists.length > 0) {
        await prisma.bookListItem.deleteMany({
          where: { bookId, listId: { in: lists.map((l) => l.id) } },
        });
      }
    })
    .catch(() => { /* table may not exist */ });

  // Active loans
  await prisma.loan
    .updateMany({
      where: {
        lenderId: userId,
        bookId,
        status: { in: ["REQUESTED", "OFFERED", "ACTIVE"] },
      },
      data: { status: "DECLINED" },
    })
    .catch(() => { /* table may not exist */ });
}
