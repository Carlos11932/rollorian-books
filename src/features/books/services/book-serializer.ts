/**
 * Pure mapping functions between NormalizedBook (Google Books API shape)
 * and the domain types used in the UI and persistence layers.
 *
 * Eliminates the duplicated `toDisplayBook` that lived in both
 * `search-results-grid.tsx` and `search/page.tsx`.
 */

import type { NormalizedBook } from "@/lib/google-books/types";
import type { SerializableBook, CreateBookPayload } from "@/features/books/types";

/**
 * Maps a NormalizedBook (external search result) to a SerializableBook
 * suitable for rendering in BookCard components.
 *
 * The `id` is set to `externalId` — it is NOT a database ID.
 */
export function toDisplayBook(book: NormalizedBook): SerializableBook {
  return {
    id: book.externalId,
    title: book.title,
    subtitle: null,
    authors: book.authors,
    description: null,
    coverUrl: book.coverUrl ?? null,
    publisher: null,
    publishedDate:
      book.publishedYear != null ? String(book.publishedYear) : null,
    pageCount: null,
    isbn10: null,
    isbn13: book.isbn ?? null,
    status: "WISHLIST",
    rating: null,
    notes: null,
    genres: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Maps a NormalizedBook to the payload expected by POST /api/books.
 * Optional fields that are null/undefined are omitted from the payload.
 */
export function toSavePayload(book: NormalizedBook): CreateBookPayload {
  return {
    title: book.title,
    authors: book.authors,
    ...(book.coverUrl != null && { coverUrl: book.coverUrl }),
    ...(book.publishedYear != null && {
      publishedDate: String(book.publishedYear),
    }),
    ...(book.isbn != null && { isbn13: book.isbn }),
    status: "WISHLIST",
    genres: [],
  };
}
