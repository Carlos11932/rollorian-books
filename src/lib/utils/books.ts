import type { SerializableBook } from "@/features/books/types"
import type { BookStatus } from "@/lib/types/book"
import { toTitleCase } from "./text"

/** Maximum number of genre rails shown on the home page */
export const MAX_GENRE_RAILS = 6

/** Affinity weights by reading status — higher = stronger signal of real interest */
export const AFFINITY_WEIGHTS: Record<BookStatus, number> = {
  READ: 4,
  READING: 3,
  TO_READ: 2,
  WISHLIST: 1,
}

/**
 * Groups books by genre, normalizing genre names to Title Case.
 * A book with multiple genres appears in multiple groups.
 * Skips empty or whitespace-only genre strings.
 * Returns a Map preserving insertion order.
 */
export function groupBooksByGenre(
  books: SerializableBook[],
): Map<string, SerializableBook[]> {
  const byGenre = new Map<string, SerializableBook[]>()

  for (const book of books) {
    for (const genre of book.genres) {
      if (!genre.trim()) continue
      const normalized = toTitleCase(genre)
      if (!normalized) continue
      const list = byGenre.get(normalized)
      if (list) {
        list.push(book)
      } else {
        byGenre.set(normalized, [book])
      }
    }
  }

  return byGenre
}

/**
 * Calculates an affinity score for a list of books.
 * Higher score = user has more actively engaged with this genre.
 * READ (4) > READING (3) > TO_READ (2) > WISHLIST (1).
 */
export function genreAffinityScore(books: SerializableBook[]): number {
  return books.reduce(
    (score, book) => score + (AFFINITY_WEIGHTS[book.status] ?? 1),
    0,
  )
}

/**
 * Returns the top genre rails sorted by affinity score descending,
 * capped at maxRails.
 */
export function topGenreRails(
  books: SerializableBook[],
  maxRails: number = MAX_GENRE_RAILS,
): Array<[string, SerializableBook[]]> {
  const byGenre = groupBooksByGenre(books)

  return [...byGenre.entries()]
    .sort(([, a], [, b]) => genreAffinityScore(b) - genreAffinityScore(a))
    .slice(0, maxRails)
}
