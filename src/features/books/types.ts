import type { Book, BookStatus, UserBookWithBook } from "@/lib/types/book";
import type { GoogleBooksVolume } from "@/lib/google-books/types";

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
 * Serializable version combining Book fields with UserBook reading-state fields.
 * Date fields are converted to ISO strings for passing from Server to Client components.
 *
 * `status`, `rating`, and `notes` come from the UserBook junction row,
 * while the remaining fields come from the Book itself.
 */
export type SerializableBook = Omit<Book, "createdAt" | "updatedAt"> & {
  status: BookStatus;
  rating: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Converts a UserBookWithBook (junction + included book) into a flat,
 * serialization-safe shape for passing to Client Components.
 *
 * Book-level fields come from `userBook.book`, while reading-state fields
 * (`status`, `rating`, `notes`) and timestamps come from the `userBook` itself.
 */
export function serializeUserBook(userBook: UserBookWithBook): SerializableBook {
  const { book } = userBook;
  return {
    ...book,
    status: userBook.status,
    rating: userBook.rating,
    notes: userBook.notes,
    createdAt: userBook.createdAt.toISOString(),
    updatedAt: userBook.updatedAt.toISOString(),
  };
}
