import type { Book, BookStatus, OwnershipStatus, UserBookWithBook } from "@/lib/types/book";
import type { GoogleBooksVolume } from "@/lib/google-books/types";

export const LIBRARY_COMPAT_DEGRADED_FIELD = {
  OWNERSHIP_STATUS: "ownershipStatus",
  FINISHED_AT: "finishedAt",
} as const;

export type LibraryCompatDegradedField = (
  typeof LIBRARY_COMPAT_DEGRADED_FIELD
)[keyof typeof LIBRARY_COMPAT_DEGRADED_FIELD];

export const LIBRARY_READ_STATE = {
  FULL: "full",
  DEGRADED: "degraded",
  UNAVAILABLE: "unavailable",
} as const;

export type LibraryReadState = (typeof LIBRARY_READ_STATE)[keyof typeof LIBRARY_READ_STATE];

/**
 * View model for a Google Books volume used in the book detail page.
 */
export interface GoogleBookView {
  source: "google";
  volume: GoogleBooksVolume;
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
}

/**
 * View model for an external book (OpenLibrary, etc.) used in the book detail page.
 * Similar shape to GoogleBookView but without the raw volume object.
 */
export interface ExternalBookView {
  source: "external";
  externalId: string;
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
}

/**
 * Serializable version combining Book fields with UserBook reading-state fields.
 * Date fields are converted to ISO strings for passing from Server to Client components.
 *
 * `status`, `rating`, and `notes` come from the UserBook junction row,
 * while the remaining fields come from the Book itself.
 */
export type LibraryEntryView = Omit<Book, "createdAt" | "updatedAt"> & {
  status: BookStatus;
  ownershipStatus: OwnershipStatus;
  rating: number | null;
  notes: string | null;
  compatDegraded?: true;
  compatDegradedFields?: LibraryCompatDegradedField[];
  createdAt: string;
  updatedAt: string;
};

type CompatLibraryEntry = UserBookWithBook & {
  compatDegraded?: true;
  compatDegradedFields?: LibraryCompatDegradedField[];
};

/**
 * Converts a UserBookWithBook (junction + included book) into a flat,
 * serialization-safe shape for passing to Client Components.
 *
 * Book-level fields come from `userBook.book`, while reading-state fields
 * (`status`, `rating`, `notes`) and timestamps come from the `userBook` itself.
 */
export function toLibraryEntryView(userBook: CompatLibraryEntry): LibraryEntryView {
  const { book } = userBook;
  return {
    ...book,
    status: userBook.status,
    ownershipStatus: userBook.ownershipStatus,
    rating: userBook.rating,
    notes: userBook.notes,
    compatDegraded: "compatDegraded" in userBook ? userBook.compatDegraded : undefined,
    compatDegradedFields: "compatDegradedFields" in userBook ? userBook.compatDegradedFields : undefined,
    createdAt: userBook.createdAt.toISOString(),
    updatedAt: userBook.updatedAt.toISOString(),
  };
}

export function hasCompatDegradedField(
  book: Pick<LibraryEntryView, "compatDegradedFields">,
  field: LibraryCompatDegradedField,
): boolean {
  return book.compatDegradedFields?.includes(field) ?? false;
}
