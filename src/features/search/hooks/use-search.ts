"use client";

import { useState, useEffect, useCallback } from "react";
import type { NormalizedBook } from "@/lib/google-books/types";
import type { BookStatus } from "@/lib/types/book";
import type { LibraryEntryView } from "@/features/books/types";
import {
  type UserBookApiEntry,
  type DiscoverGenre,
  type Recommendation,
  saveBookToLibrary,
} from "../lib/search-mappers";

interface DiscoverResponse {
  genres: DiscoverGenre[];
}

interface RecommendationsResponse {
  recommendations: Recommendation[];
}

interface SearchApiResponse {
  books: NormalizedBook[];
  hasMore: boolean;
  nextOffset: number;
}

export interface SearchState {
  // Search
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

  // Library index
  libraryIndex: Map<string, BookStatus>;
  getSavedStatus: (book: NormalizedBook) => BookStatus | null;

  // Discover
  discoverGenres: DiscoverGenre[];
  isDiscoverLoading: boolean;

  // Recommendations
  recommendations: Recommendation[];
  isRecommendationsLoading: boolean;

  // Scanner
  showScanner: boolean;
  setShowScanner: (v: boolean) => void;
  hasBarcodeApi: boolean;

  // Save actions
  handleSave: (displayBook: LibraryEntryView) => Promise<void>;
  handleDiscoverSave: (displayBook: LibraryEntryView) => Promise<void>;
}

export function useSearch(): SearchState {
  const [inputValue, setInputValue] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NormalizedBook[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [hasBarcodeApi, setHasBarcodeApi] = useState(false);

  const [libraryIndex, setLibraryIndex] = useState<Map<string, BookStatus>>(new Map());
  const [discoverGenres, setDiscoverGenres] = useState<DiscoverGenre[]>([]);
  const [isDiscoverLoading, setIsDiscoverLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isRecommendationsLoading, setIsRecommendationsLoading] = useState(true);

  // Feature-detect BarcodeDetector on mount
  useEffect(() => {
    setHasBarcodeApi(typeof globalThis.BarcodeDetector !== "undefined");
  }, []);

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

  // Load discover genres on mount
  useEffect(() => {
    setIsDiscoverLoading(true);
    void fetch("/api/discover/genres")
      .then((res) => (res.ok ? (res.json() as Promise<DiscoverResponse>) : Promise.resolve({ genres: [] })))
      .then((data) => setDiscoverGenres(data.genres))
      .catch(() => {})
      .finally(() => setIsDiscoverLoading(false));
  }, []);

  // Load recommendations on mount
  useEffect(() => {
    setIsRecommendationsLoading(true);
    void fetch("/api/recommendations")
      .then((res) => (res.ok ? (res.json() as Promise<RecommendationsResponse>) : Promise.resolve({ recommendations: [] })))
      .then((data) => setRecommendations(data.recommendations))
      .catch(() => {})
      .finally(() => setIsRecommendationsLoading(false));
  }, []);

  const handleSearch = useCallback(async (searchQuery: string) => {
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
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (!query || isLoadingMore || !hasMore) return;

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
    }
  }, [query, isLoadingMore, hasMore, nextOffset]);

  const getSavedStatus = useCallback(
    (book: NormalizedBook): BookStatus | null => {
      return book.isbn ? libraryIndex.get(book.isbn) ?? null : null;
    },
    [libraryIndex],
  );

  const handleSave = useCallback(
    async (displayBook: LibraryEntryView) => {
      const original = results.find((r) => r.externalId === displayBook.id);
      if (!original) return;
      await saveBookToLibrary(original);
      if (original.isbn) {
        setLibraryIndex((prev) => new Map(prev).set(original.isbn!, "WISHLIST"));
      }
    },
    [results],
  );

  const handleDiscoverSave = useCallback(
    async (displayBook: LibraryEntryView) => {
      const original = discoverGenres
        .flatMap((g) => g.books)
        .find((b) => b.externalId === displayBook.id);
      if (!original) return;
      await saveBookToLibrary(original);
      if (original.isbn) {
        setLibraryIndex((prev) => new Map(prev).set(original.isbn!, "WISHLIST"));
      }
    },
    [discoverGenres],
  );

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
    libraryIndex,
    getSavedStatus,
    discoverGenres,
    isDiscoverLoading,
    recommendations,
    isRecommendationsLoading,
    showScanner,
    setShowScanner,
    hasBarcodeApi,
    handleSave,
    handleDiscoverSave,
  };
}
