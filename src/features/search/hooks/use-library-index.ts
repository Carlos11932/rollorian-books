"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchAllBooks } from "@/features/books/services/books-api";
import type { SerializableBook } from "@/features/books/types";
import type { BookStatus } from "@/lib/types/book";

interface UseLibraryIndexReturn {
  /** Look up saved status by ISBN. Returns null when not in library. */
  getStatus: (isbn: string | null) => BookStatus | null;
  /** All library books — used for "Archived Suggestions" section. */
  suggestions: SerializableBook[];
  /** Optimistically mark an ISBN as saved (WISHLIST) without re-fetching. */
  markSaved: (isbn: string) => void;
  /** Whether the initial library fetch is still in progress. */
  isLoading: boolean;
}

/**
 * Fetches the user's library on mount and indexes books by isbn13
 * for O(1) "already saved" lookups in the search page.
 *
 * Also exposes the full book list as suggestions and a `markSaved`
 * helper for optimistic UI after a successful save.
 *
 * Used by: search page to show "already saved" state
 */
export function useLibraryIndex(): UseLibraryIndexReturn {
  const [libraryMap, setLibraryMap] = useState<Map<string, BookStatus>>(
    new Map(),
  );
  const [suggestions, setSuggestions] = useState<SerializableBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void fetchAllBooks()
      .then((books) => {
        if (cancelled) return;

        const index = new Map<string, BookStatus>();
        for (const book of books) {
          if (book.isbn13) {
            index.set(book.isbn13, book.status);
          }
        }

        setLibraryMap(index);
        // Cast is safe — the API returns full book objects with string dates
        setSuggestions(books as unknown as SerializableBook[]);
      })
      .catch(() => {
        // Non-critical — search still works without library data
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const getStatus = useCallback(
    (isbn: string | null): BookStatus | null => {
      if (!isbn) return null;
      return libraryMap.get(isbn) ?? null;
    },
    [libraryMap],
  );

  const markSaved = useCallback((isbn: string) => {
    setLibraryMap((prev) => new Map(prev).set(isbn, "WISHLIST"));
  }, []);

  return { getStatus, suggestions, markSaved, isLoading };
}
