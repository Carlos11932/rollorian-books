/**
 * Manually-defined Book model and BookStatus enum that mirror the Prisma schema.
 *
 * WHY: Prisma 7 with driver adapters does NOT reliably export model types
 * (like `Book`) from `@prisma/client` on every platform. The enum
 * `BookStatus` IS exported, but for consistency we co-locate both here.
 *
 * These types MUST stay in sync with `prisma/schema.prisma`.
 */

export const BookStatus = {
  WISHLIST: "WISHLIST",
  TO_READ: "TO_READ",
  READING: "READING",
  REREADING: "REREADING",
  READ: "READ",
  ON_HOLD: "ON_HOLD",
} as const;

export type BookStatus = (typeof BookStatus)[keyof typeof BookStatus];

/** Ordered array of all BookStatus values for iteration */
export const BOOK_STATUS_VALUES: BookStatus[] = [
  BookStatus.WISHLIST,
  BookStatus.TO_READ,
  BookStatus.READING,
  BookStatus.REREADING,
  BookStatus.READ,
  BookStatus.ON_HOLD,
] as const;


export const OwnershipStatus = {
  OWNED: "OWNED",
  NOT_OWNED: "NOT_OWNED",
  UNKNOWN: "UNKNOWN",
} as const;

export type OwnershipStatus = (typeof OwnershipStatus)[keyof typeof OwnershipStatus];

/** Ordered array of all OwnershipStatus values for iteration */
export const OWNERSHIP_STATUS_VALUES: OwnershipStatus[] = [
  OwnershipStatus.OWNED,
  OwnershipStatus.NOT_OWNED,
  OwnershipStatus.UNKNOWN,
] as const;


export interface Book {
  id: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  description: string | null;
  coverUrl: string | null;
  publisher: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  isbn10: string | null;
  isbn13: string | null;
  genres: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserBook {
  id: string;
  userId: string;
  bookId: string;
  status: BookStatus;
  ownershipStatus: OwnershipStatus;
  finishedAt: Date | null;
  rating: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserBookWithBook extends UserBook {
  book: Book;
}

export interface BookWithUserData extends Book {
  userBooks: UserBook[];
}

// ── Book Lists (Shelves) ────────────────────────────────────────────────────

export interface BookList {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BookListItem {
  id: string;
  listId: string;
  bookId: string;
  addedAt: Date;
}

export interface BookListWithItems extends BookList {
  items: (BookListItem & { book: Book })[];
}

export interface BookListSummary extends BookList {
  _count: { items: number };
  containsBook?: boolean;
}
