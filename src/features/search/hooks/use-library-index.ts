"use client";

import { useState, useEffect } from "react";
import type { NormalizedBook } from "@/lib/google-books/types";
import type { BookStatus } from "@/lib/types/book";
import type { UserBookApiEntry } from "../lib/search-mappers";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface LibraryIndexState {
  libraryIndex: Map<string, BookStatus>;
  getSavedStatus: (book: NormalizedBook) => BookStatus | null;
  setLibraryIndex: React.Dispatch<React.SetStateAction<Map<string, BookStatus>>>;
}

/**
 * Fetches GET /api/books on mount and builds a Map<isbn13, BookStatus>
 * so the search UI can indicate which books are already in the library.
 */
export function useLibraryIndex(): LibraryIndexState {
  const [libraryIndex, setLibraryIndex] = useState<Map<string, BookStatus>>(new Map());

  // Load library index on mount
  useEffect(() => {
    void fetch("/api/books")
      .then((res) => (res.ok ? res.json() : []))
      .then((entries: UserBookApiEntry[]) => {
        const index = new Map<string, BookStatus>();
        for (const entry of entries) {
          if (entry.book.isbn13) index.set(entry.book.isbn13, entry.status);
        }
        setLibraryIndex(index);
      })
      .catch(() => {});
  }, []);

  function getSavedStatus(book: NormalizedBook): BookStatus | null {
    return book.isbn ? libraryIndex.get(book.isbn) ?? null : null;
  }

  return { libraryIndex, getSavedStatus, setLibraryIndex };
}
