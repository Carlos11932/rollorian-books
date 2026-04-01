import type { NormalizedBook } from "../types";
import type { OpenLibraryDoc } from "./types";

const MAX_GENRES = 5;

function isIsbn13(isbn: string): boolean {
  return isbn.length === 13 && (isbn.startsWith("978") || isbn.startsWith("979"));
}

function selectIsbn(isbns: string[] | undefined): string | null {
  if (!Array.isArray(isbns) || isbns.length === 0) {
    return null;
  }

  const isbn13 = isbns.find(isIsbn13);
  if (isbn13) return isbn13;

  // Fallback to first ISBN-10 (10-digit string)
  const isbn10 = isbns.find((i) => i.length === 10);
  if (isbn10) return isbn10;

  // Last resort: first available ISBN
  return isbns[0] ?? null;
}

function buildCoverUrl(doc: OpenLibraryDoc, isbn: string | null): string | null {
  if (doc.cover_i != null) {
    return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
  }

  if (isbn) {
    return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
  }

  return null;
}

function normalizeDoc(doc: OpenLibraryDoc): NormalizedBook | null {
  if (!doc.title) {
    return null;
  }

  const isbn = selectIsbn(doc.isbn);

  return {
    externalSource: "open_library",
    externalId: doc.key,
    title: doc.title,
    authors: doc.author_name ?? [],
    publishedYear: doc.first_publish_year ?? null,
    isbn,
    coverUrl: buildCoverUrl(doc, isbn),
    description: undefined,
    pageCount: doc.number_of_pages_median ?? undefined,
    publisher: doc.publisher?.[0] ?? undefined,
    genres: doc.subject?.slice(0, MAX_GENRES) ?? undefined,
    subtitle: doc.subtitle ?? undefined,
  };
}

export function normalizeOpenLibraryResults(
  docs: OpenLibraryDoc[]
): NormalizedBook[] {
  return docs
    .map(normalizeDoc)
    .filter((book): book is NormalizedBook => book !== null);
}
