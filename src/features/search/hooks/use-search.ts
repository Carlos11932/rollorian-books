"use client";

import { useState, useEffect } from "react";
import type { LibraryEntryView } from "@/features/books/types";
import { saveBookToLibrary } from "../lib/search-mappers";
import { useSearchQuery } from "./use-search-query";
import { useLibraryIndex } from "./use-library-index";
import { useDiscover } from "./use-discover";
import type { DiscoverGenre, Recommendation } from "../lib/search-mappers";
import type { NormalizedBook } from "@/lib/google-books/types";
import type { BookStatus } from "@/lib/types/book";

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
  const [showScanner, setShowScanner] = useState(false);
  const [hasBarcodeApi, setHasBarcodeApi] = useState(false);

  const searchQuery = useSearchQuery();
  const { libraryIndex, getSavedStatus, setLibraryIndex } = useLibraryIndex();
  const { discoverGenres, isDiscoverLoading, recommendations, isRecommendationsLoading } = useDiscover();

  // Feature-detect BarcodeDetector on mount
  useEffect(() => {
    setHasBarcodeApi(typeof globalThis.BarcodeDetector !== "undefined");
  }, []);

  async function handleSave(displayBook: LibraryEntryView) {
    const original = searchQuery.results.find((r) => r.externalId === displayBook.id);
    if (!original) return;
    await saveBookToLibrary(original);
    if (original.isbn) {
      setLibraryIndex((prev) => new Map(prev).set(original.isbn!, "WISHLIST"));
    }
  }

  async function handleDiscoverSave(displayBook: LibraryEntryView) {
    const original = discoverGenres
      .flatMap((g) => g.books)
      .find((b) => b.externalId === displayBook.id);
    if (!original) return;
    await saveBookToLibrary(original);
    if (original.isbn) {
      setLibraryIndex((prev) => new Map(prev).set(original.isbn!, "WISHLIST"));
    }
  }

  return {
    ...searchQuery,
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
