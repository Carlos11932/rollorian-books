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
  READ: "READ",
} as const;

export type BookStatus = (typeof BookStatus)[keyof typeof BookStatus];

/** Ordered array of all BookStatus values for iteration */
export const BOOK_STATUS_VALUES: BookStatus[] = [
  BookStatus.WISHLIST,
  BookStatus.TO_READ,
  BookStatus.READING,
  BookStatus.READ,
] as const;

/** Display labels for each BookStatus */
export const BOOK_STATUS_LABELS: Record<BookStatus, string> = {
  WISHLIST: "Wishlist",
  TO_READ: "To Read",
  READING: "Reading",
  READ: "Read",
};

/** Pre-built options array for select/dropdown components */
export const BOOK_STATUS_OPTIONS: { value: BookStatus; label: string }[] =
  BOOK_STATUS_VALUES.map((value) => ({ value, label: BOOK_STATUS_LABELS[value] }));

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
