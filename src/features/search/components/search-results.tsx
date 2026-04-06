"use client";

import { useTranslations } from "next-intl";
import type { NormalizedBook } from "@/lib/google-books/types";
import type { LibraryEntryView } from "@/features/books/types";
import type { BookStatus } from "@/lib/types/book";
import { toDisplayBook } from "../lib/search-mappers";
import { BookCard } from "@/features/books/components/book-card";
import { Skeleton } from "@/features/shared/components/skeleton";

interface SearchResultsProps {
  query: string;
  results: NormalizedBook[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasSearched: boolean;
  hasMore: boolean;
  error: string | null;
  getSavedStatus: (book: NormalizedBook) => BookStatus | null;
  onSave: (book: LibraryEntryView) => Promise<void>;
  onLoadMore: () => void;
}

export function SearchResults({
  query,
  results,
  isLoading,
  isLoadingMore,
  hasSearched,
  hasMore,
  error,
  getSavedStatus,
  onSave,
  onLoadMore,
}: SearchResultsProps) {
  const t = useTranslations();

  if (error != null) {
    return (
      <div
        role="alert"
        className="max-w-2xl mx-auto mb-8 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
      >
        {error}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
        aria-busy="true"
        aria-label={t("search.loading")}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="grid gap-2">
            <Skeleton variant="card" className="aspect-[2/3] rounded-lg" />
            <Skeleton variant="text" className="h-4 w-3/4" />
            <Skeleton variant="text" className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (hasSearched && results.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 mt-16 text-center">
        <span
          className="material-symbols-outlined text-on-surface-variant/40"
          style={{ fontSize: "64px" }}
        >
          menu_book
        </span>
        <p className="text-lg font-medium text-on-surface-variant">
          {t("search.noResults", { query })}
        </p>
        <p className="text-sm text-outline">{t("search.tryAnother")}</p>
      </div>
    );
  }

  if (hasSearched && results.length > 0) {
    return (
      <section aria-label={t("search.resultsLabel")} aria-live="polite">
        <p className="text-tertiary text-sm mb-6">
          {t("search.resultsCount", { count: results.length, query })}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {results.map((book, index) => (
            <BookCard
              key={book.externalId}
              variant="search"
              book={toDisplayBook(book)}
              index={index}
              savedStatus={getSavedStatus(book)}
              onSave={onSave}
            />
          ))}
        </div>

        {/* Load more button */}
        {hasMore && (
          <div className="flex justify-center mt-8">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 text-text border border-line font-bold text-sm transition-all hover:-translate-y-px disabled:opacity-50 disabled:cursor-wait"
            >
              {isLoadingMore ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-line border-t-accent animate-spin" />
                  {t("search.loadingMore")}
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">expand_more</span>
                  {t("search.loadMore")}
                </>
              )}
            </button>
          </div>
        )}
      </section>
    );
  }

  return null;
}
