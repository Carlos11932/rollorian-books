import "server-only";

import { type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { USER_BOOK_SELECT } from "@/lib/books/user-book-select";
import { isMissingDonnaStateSchemaError } from "@/lib/prisma-schema-compat";
import type { DonnaSemanticState } from "./contracts";

export type SelectedUserBook = Prisma.UserBookGetPayload<{ select: typeof USER_BOOK_SELECT }>;

export type NormalizedBook = {
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

/** Minimum shape required by `normalizeBook` — covers both full Book records and partial selects. */
export type BookInput = {
  id: string;
  title: string;
  subtitle?: string | null;
  authors: string[];
  description?: string | null;
  coverUrl?: string | null;
  publisher?: string | null;
  publishedDate?: string | null;
  pageCount?: number | null;
  isbn10?: string | null;
  isbn13?: string | null;
  genres: string[];
};

export type NormalizedLibraryEntry = {
  book: NormalizedBook;
  status: SelectedUserBook["status"];
  ownershipStatus: SelectedUserBook["ownershipStatus"];
  semanticState: DonnaSemanticState;
  rating: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
};

export function normalizeBook(book: BookInput): NormalizedBook {
  return {
    id: book.id,
    title: book.title,
    subtitle: book.subtitle ?? null,
    authors: book.authors,
    description: book.description ?? null,
    coverUrl: book.coverUrl ?? null,
    publisher: book.publisher ?? null,
    publishedDate: book.publishedDate ?? null,
    pageCount: book.pageCount ?? null,
    isbn10: book.isbn10 ?? null,
    isbn13: book.isbn13 ?? null,
    genres: book.genres,
  };
}

export function getSemanticState(
  status: SelectedUserBook["status"],
  overrideState?: DonnaSemanticState | null,
): DonnaSemanticState {
  if (overrideState) {
    return overrideState;
  }

  switch (status) {
    case "WISHLIST":
      return "wishlist";
    case "TO_READ":
      return "to_read";
    case "READING":
      return "reading";
    case "REREADING":
      return "rereading";
    case "READ":
      return "read";
    case "ON_HOLD":
      return "paused";
    default:
      return "to_read";
  }
}

export function normalizeEntry(
  entry: SelectedUserBook,
  semanticState?: DonnaSemanticState | null,
): NormalizedLibraryEntry {
  return {
    book: normalizeBook(entry.book),
    status: entry.status,
    ownershipStatus: entry.ownershipStatus,
    semanticState: getSemanticState(entry.status, semanticState),
    rating: entry.rating ?? null,
    notes: entry.notes ?? null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    finishedAt: null,
  };
}

export function normalizeTitle(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function normalizeAuthorSet(value: string[] | undefined): Set<string> {
  return new Set((value ?? []).map((author) => normalizeTitle(author)));
}

export async function getDonnaStateMap(
  userId: string,
  bookIds: string[],
): Promise<Map<string, DonnaSemanticState>> {
  if (bookIds.length === 0) {
    return new Map();
  }

  try {
    const rows = await prisma.donnaBookState.findMany({
      where: { userId, bookId: { in: bookIds } },
      select: { bookId: true, semanticState: true },
    });

    return new Map(rows.map((row) => [
      row.bookId,
      row.semanticState.toLowerCase() as DonnaSemanticState,
    ]));
  } catch (error) {
    if (isMissingDonnaStateSchemaError(error)) {
      return new Map();
    }
    throw error;
  }
}

export async function getLibraryEntriesForUser(userId: string): Promise<NormalizedLibraryEntry[]> {
  const rows = await prisma.userBook.findMany({
    where: { userId },
    select: USER_BOOK_SELECT,
    orderBy: { updatedAt: "desc" },
  });
  const stateMap = await getDonnaStateMap(userId, rows.map((row) => row.bookId));
  return rows.map((row) => normalizeEntry(row, stateMap.get(row.bookId)));
}
