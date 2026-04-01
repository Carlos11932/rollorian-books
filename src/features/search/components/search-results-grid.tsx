"use client";

import type { NormalizedBook } from "@/lib/google-books/types";
import { BookCard } from "@/features/books/components/book-card";
import { Skeleton } from "@/features/shared/components/skeleton";
import { EmptyState } from "@/features/shared/components/empty-state";
import type { LibraryEntryView } from "@/features/books/types";

interface SearchResultsGridProps {
  results: NormalizedBook[];
  isLoading?: boolean;
  hasSearched?: boolean;
}

/**
 * Maps a NormalizedBook to a partial LibraryEntryView suitable for display.
 * The "fake" id is the externalId — it's never used for DB lookups here.
 */
function toDisplayBook(book: NormalizedBook): LibraryEntryView {
  return {
    id: book.externalId,
    title: book.title,
    subtitle: null,
    authors: book.authors,
    description: null,
    coverUrl: book.coverUrl ?? null,
    publisher: null,
    publishedDate: book.publishedYear != null ? String(book.publishedYear) : null,
    pageCount: null,
    isbn10: null,
    isbn13: book.isbn ?? null,
    status: "WISHLIST",
    rating: null,
    notes: null,
    genres: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function saveBookToLibrary(book: NormalizedBook): Promise<void> {
  const authors = book.authors.length > 0 ? book.authors : ["Unknown"];
  const isbn = book.isbn ?? null;

  const payload = {
    title: book.title,
    authors,
    coverUrl: book.coverUrl ?? undefined,
    publishedDate: book.publishedYear != null ? String(book.publishedYear) : undefined,
    isbn13: isbn && isbn.length === 13 ? isbn : undefined,
    isbn10: isbn && isbn.length === 10 ? isbn : undefined,
    status: "WISHLIST" as const,
    genres: book.genres ?? [],
  };

  const res = await fetch("/api/books", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? "Failed to save book");
  }
}

const SKELETON_WIDTHS = [160, 160, 160, 160, 160, 160, 160, 160] as const;

export function SearchResultsGrid({
  results,
  isLoading = false,
  hasSearched = false,
}: SearchResultsGridProps) {
  async function handleSave(displayBook: LibraryEntryView): Promise<void> {
    // Find the original NormalizedBook to save correctly
    const original = results.find((r) => r.externalId === displayBook.id);
    if (!original) return;
    await saveBookToLibrary(original);
  }

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

  if (results.length === 0) {
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
      aria-label={`${results.length} search results`}
    >
      {results.map((book, index) => (
        <BookCard
          key={book.externalId}
          variant="search"
          book={toDisplayBook(book)}
          index={index}
          onSave={handleSave}
        />
      ))}
    </div>
  );
}
