import type { NormalizedBook } from "@/lib/google-books/types";
import type { LibraryEntryView } from "@/features/books/types";
import type { BookStatus } from "@/lib/types/book";
import { saveBook } from "@/lib/api/books";

/** Shape returned by GET /api/books (UserBookWithBook from the API). */
export interface UserBookApiEntry {
  id: string;
  status: BookStatus;
  rating: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  book: {
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
  };
}

export interface DiscoverGenre {
  name: string;
  books: NormalizedBook[];
}

export interface Recommendation {
  book: {
    id: string;
    title: string;
    authors: string[];
    coverUrl: string | null;
    isbn13: string | null;
    genres: string[];
  };
  readerCount: number;
}

/** Map a NormalizedBook to the shape BookCard expects. */
export function toDisplayBook(book: NormalizedBook): LibraryEntryView {
  return {
    id: book.externalId,
    title: book.title,
    subtitle: null,
    authors: book.authors,
    description: null,
    coverUrl: book.coverUrl ?? null,
    publisher: null,
    publishedDate: book.publishedYear != null ? String(book.publishedYear) : null,
    pageCount: null,
    isbn10: null,
    isbn13: book.isbn ?? null,
    status: "WISHLIST",
    ownershipStatus: "UNKNOWN",
    rating: null,
    notes: null,
    genres: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** Map a Recommendation to the shape BookCard expects. */
export function recommendationToDisplayBook(rec: Recommendation): LibraryEntryView {
  return {
    id: rec.book.id,
    title: rec.book.title,
    subtitle: null,
    authors: rec.book.authors,
    description: null,
    coverUrl: rec.book.coverUrl,
    publisher: null,
    publishedDate: null,
    pageCount: null,
    isbn10: null,
    isbn13: rec.book.isbn13,
    status: "WISHLIST",
    ownershipStatus: "UNKNOWN",
    rating: null,
    notes: null,
    genres: rec.book.genres,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** Save a NormalizedBook to the user's library via the API. */
export async function saveBookToLibrary(book: NormalizedBook): Promise<void> {
  const authors = book.authors.length > 0 ? book.authors : ["Unknown"];
  const isbn = book.isbn ?? null;
  const isbn13 = isbn && isbn.length === 13 ? isbn : undefined;
  const isbn10 = isbn && isbn.length === 10 ? isbn : undefined;

  await saveBook({
    title: book.title,
    authors,
    coverUrl: book.coverUrl ?? undefined,
    publishedDate: book.publishedYear != null ? String(book.publishedYear) : undefined,
    isbn13,
    isbn10,
    status: "WISHLIST" as const,
    genres: book.genres ?? [],
  });
}
