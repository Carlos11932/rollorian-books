"use client";

import { BookCard } from "@/features/books/components/book-card";
import { Skeleton } from "@/features/shared/components/skeleton";
import { EmptyState } from "@/features/shared/components/empty-state";
import type { SerializableBook } from "@/features/books/types";
import type { BookStatus } from "@/lib/types/book";

interface SearchResultsGridProps {
  books: SerializableBook[];
  isLoading?: boolean;
  hasSearched?: boolean;
  /** Look up whether a book is already saved by its display book id. */
  getSavedStatus?: (book: SerializableBook) => BookStatus | null;
  /** Save a book to the library. */
  onSave?: (book: SerializableBook) => Promise<void>;
}

const SKELETON_WIDTHS = [160, 160, 160, 160, 160, 160, 160, 160] as const;

export function SearchResultsGrid({
  books,
  isLoading = false,
  hasSearched = false,
  getSavedStatus,
  onSave,
}: SearchResultsGridProps) {
  if (isLoading) {
    return (
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
        aria-busy="true"
        aria-label="Loading search results"
      >
        {SKELETON_WIDTHS.map((_, i) => (
          <div key={i} className="grid gap-2">
            <Skeleton variant="card" className="h-[220px]" />
            <Skeleton variant="text" className="h-4 w-3/4" />
            <Skeleton variant="text" className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (!hasSearched) {
    return (
      <EmptyState
        icon={
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        }
        title="Start with a real query"
        description="Search by title, author, or ISBN to load this rail with candidate books."
      />
    );
  }

  if (books.length === 0) {
    return (
      <EmptyState
        icon="📚"
        title="No matches found"
        description="Try a different title, author, or ISBN query."
      />
    );
  }

  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
      aria-label={`${books.length} search results`}
    >
      {books.map((book, index) => (
        <BookCard
          key={book.id}
          variant="search"
          book={book}
          index={index}
          savedStatus={getSavedStatus?.(book) ?? null}
          onSave={onSave}
        />
      ))}
    </div>
  );
}
