"use client";

import { useState, useRef } from "react";
import type { NormalizedBook } from "@/lib/google-books/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchApiResponse {
  books: NormalizedBook[];
  hasMore: boolean;
  nextOffset: number;
}

export interface SearchQueryState {
  inputValue: string;
  setInputValue: (v: string) => void;
  query: string;
  results: NormalizedBook[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasSearched: boolean;
  hasMore: boolean;
  error: string | null;
  handleSearch: (q: string) => Promise<void>;
  handleLoadMore: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages search query state, pagination, and the Google Books API calls.
 */
export function useSearchQuery(): SearchQueryState {
  const [inputValue, setInputValue] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NormalizedBook[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(searchQuery: string) {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    setQuery(trimmed);
    setIsLoading(true);
    setError(null);
    setResults([]);
    setHasMore(false);

    try {
      const res = await fetch(`/api/search/books?q=${encodeURIComponent(trimmed)}`);
      const data: unknown = await res.json();

      if (!res.ok) {
        const errData = data as { error?: string };
        setError(errData.error ?? "Search failed. Please try again.");
        return;
      }

      const response = data as SearchApiResponse;
      setResults(response.books);
      setHasMore(response.hasMore);
      setNextOffset(response.nextOffset);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
      setHasSearched(true);
    }
  }

  // Ref guard prevents same-tick re-entry on rapid clicks
  const loadMoreLock = useRef(false);

  async function handleLoadMore() {
    if (!query || !hasMore || loadMoreLock.current) return;
    loadMoreLock.current = true;
    setIsLoadingMore(true);

    try {
      const res = await fetch(
        `/api/search/books?q=${encodeURIComponent(query)}&offset=${nextOffset}`,
      );
      if (!res.ok) return;

      const data = (await res.json()) as SearchApiResponse;
      setResults((prev) => [...prev, ...data.books]);
      setHasMore(data.hasMore);
      setNextOffset(data.nextOffset);
    } catch {
      // Silent fail for load more — user can retry
    } finally {
      setIsLoadingMore(false);
      loadMoreLock.current = false;
    }
  }

  return {
    inputValue,
    setInputValue,
    query,
    results,
    isLoading,
    isLoadingMore,
    hasSearched,
    hasMore,
    error,
    handleSearch,
    handleLoadMore,
  };
}
