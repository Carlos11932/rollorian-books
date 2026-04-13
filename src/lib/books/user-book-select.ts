/**
 * Safe `select` clause for UserBook queries that avoids requesting columns
 * (like `finishedAt`) that may not exist in preview databases with schema drift.
 *
 * Prisma 7 returns "(not available)" instead of column names in P2022 errors,
 * making regex-based error detection unreliable. Using explicit `select`
 * prevents the error from occurring in the first place.
 *
 * Use this EVERYWHERE instead of `include: { book: true }` on UserBook queries.
 */
export const USER_BOOK_SELECT = {
  id: true,
  userId: true,
  bookId: true,
  status: true,
  ownershipStatus: true,
  rating: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  book: true,
} as const;
