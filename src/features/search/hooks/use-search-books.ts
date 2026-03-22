"use client";

import { useState, useCallback } from "react";
import type { NormalizedBook } from "@/lib/google-books/types";
import { apiGet } from "@/services/api-client";

interface UseSearchBooksReturn {
  /** Current search results. */
  results: NormalizedBook[];
  /** The last submitted query (trimmed). */
  query: string;
  /** Controlled input value for the search field. */
  inputValue: string;
  /** Update the controlled input value. */
  setInputValue: (value: string) => void;
  /** Execute a search. No-op for empty/whitespace-only queries. */
  search: (q: string) => Promise<void>;
  /** Whether a search request is in flight. */
  isLoading: boolean;
  /** Whether at least one search has completed (used to toggle UI states). */
  hasSearched: boolean;
  /** Error message from the last failed search, or null. */
  error: string | null;
}

/**
 * Manages search query state, loading, results, and errors.
 *
 * Calls `GET /api/search/books?q=...` via the shared API client.
 * Empty queries are silently ignored (no fetch, no state change).
 *
 * Used by: search page
 */
export function useSearchBooks(): UseSearchBooksReturn {
  const [results, setResults] = useState<NormalizedBook[]>([]);
  const [query, setQuery] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (q: string): Promise<void> => {
    const trimmed = q.trim();
    if (!trimmed) return;

    setQuery(trimmed);
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiGet<NormalizedBook[]>(
        `/api/search/books?q=${encodeURIComponent(trimmed)}`,
      );
      setResults(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Network error. Please check your connection and try again.",
      );
      setResults([]);
    } finally {
      setIsLoading(false);
      setHasSearched(true);
    }
  }, []);

  return {
    results,
    query,
    inputValue,
    setInputValue,
    search,
    isLoading,
    hasSearched,
    error,
  };
}
