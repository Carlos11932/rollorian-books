import type { Book } from "@/lib/types/book";
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
 * Serializable version of the Prisma Book model.
 * Date fields are converted to ISO strings when passing from Server to Client components.
 */
export type SerializableBook = Omit<Book, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

/**
 * Converts a Prisma Book to a serialization-safe version for passing to Client Components.
 */
export function serializeBook(book: Book): SerializableBook {
  return {
    ...book,
    createdAt: book.createdAt.toISOString(),
    updatedAt: book.updatedAt.toISOString(),
  };
}
