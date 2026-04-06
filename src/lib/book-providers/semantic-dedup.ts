/**
 * Semantic book deduplication.
 *
 * Merges different editions of the SAME book (same title + same author,
 * different publisher/ISBN/edition) into a single entry with the best metadata.
 *
 * Does NOT merge different books in a series — "Wheel of Time 1" and
 * "Wheel of Time 2" are distinct books.
 */

import type { NormalizedBook } from "./types";

// ---------------------------------------------------------------------------
// Title normalization
// ---------------------------------------------------------------------------

/**
 * Extracts a "core title" by stripping edition info, subtitles, and noise.
 *
 * "The Eye of the World (Wheel of Time, #1)" → "the eye of the world"
 * "El Ojo del Mundo: La Rueda del Tiempo 1 — Edición especial" → "el ojo del mundo"
 * "The Eye of the World - Hardcover Edition" → "the eye of the world"
 */
/**
 * Extracts a "core title" for dedup comparison.
 *
 * IMPORTANT: Does NOT strip subtitles after `:` or `—` because series
 * volumes often use them as identifiers:
 *   "The Dark Tower: The Gunslinger" vs "The Dark Tower: The Drawing of the Three"
 * Stripping after `:` would merge them — a critical false positive.
 *
 * Instead, only strips: parentheticals, edition markers, and noise chars.
 */
function coreTitle(rawTitle: string): string {
  return rawTitle
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    // Remove parenthetical content: (Wheel of Time, #1)
    .replace(/\([^)]*\)/g, "")
    // Remove edition markers (but keep subtitle content)
    .replace(
      /\b(edition|edicion|hardcover|paperback|tapa dura|tapa blanda|pocket|special|anniversary|illustrated|omnibus|deluxe|collector|revised|reprint)\b.*/gi,
      "",
    )
    // Collapse non-alphanum to spaces (keeps subtitle separators as spaces)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalizes an author name for comparison.
 * "Robert Jordan" and "ROBERT JORDAN" → "robert jordan"
 */
function normalizeAuthor(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Creates a "book identity key" for dedup.
 * Same author set + same core title = same book.
 */
function bookKey(book: NormalizedBook): string {
  const title = coreTitle(book.title);
  const authors = book.authors
    .map(normalizeAuthor)
    .filter(Boolean)
    .sort()
    .join("+");
  return `${authors}||${title}`;
}

// ---------------------------------------------------------------------------
// Metadata quality scoring — prefer books with richer data
// ---------------------------------------------------------------------------

function metadataScore(book: NormalizedBook): number {
  let score = 0;
  if (book.coverUrl) score += 3;
  if (book.description && book.description.length > 50) score += 2;
  if (book.pageCount && book.pageCount > 0) score += 1;
  if (book.isbn) score += 2;
  if (book.publisher) score += 1;
  if (book.genres && book.genres.length > 0) score += 1;
  return score;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Deduplicates books semantically — merges editions of the same book
 * into the entry with the best metadata. Different volumes in a series
 * are NOT merged.
 */
export function semanticDedup(books: NormalizedBook[]): NormalizedBook[] {
  const groups = new Map<string, NormalizedBook[]>();

  for (const book of books) {
    const key = bookKey(book);
    const group = groups.get(key) ?? [];
    group.push(book);
    groups.set(key, group);
  }

  const result: NormalizedBook[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]!);
      continue;
    }

    // Pick the one with best metadata, merge supplementary fields from others
    group.sort((a, b) => metadataScore(b) - metadataScore(a));
    const best = { ...group[0]! };

    // Fill gaps from lower-ranked editions
    for (let i = 1; i < group.length; i++) {
      const alt = group[i]!;
      if (!best.coverUrl && alt.coverUrl) best.coverUrl = alt.coverUrl;
      if (!best.description && alt.description) best.description = alt.description;
      if (!best.pageCount && alt.pageCount) best.pageCount = alt.pageCount;
      if (!best.isbn && alt.isbn) best.isbn = alt.isbn;
      if (!best.publisher && alt.publisher) best.publisher = alt.publisher;
      if ((!best.genres || best.genres.length === 0) && alt.genres?.length) {
        best.genres = alt.genres;
      }
    }

    result.push(best);
  }

  return result;
}

// Export for testing
export { coreTitle as _coreTitle, normalizeAuthor as _normalizeAuthor };
