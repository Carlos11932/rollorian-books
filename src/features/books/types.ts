import type { Book, BookStatus } from "@/lib/types/book";

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

// ── API Payload Types ──────────────────────────────────────────────────────

/** Payload sent to POST /api/books when saving a new book to the library. */
export interface CreateBookPayload {
  title: string;
  authors: string[];
  coverUrl?: string;
  publishedDate?: string;
  isbn13?: string;
  status: BookStatus;
  genres: string[];
  subtitle?: string;
  description?: string;
  publisher?: string;
  pageCount?: number;
  isbn10?: string;
}

/** Payload sent to PATCH /api/books/[id] for partial book updates. */
export interface UpdateBookPayload {
  status?: BookStatus;
  rating?: number | null;
  notes?: string | null;
}
