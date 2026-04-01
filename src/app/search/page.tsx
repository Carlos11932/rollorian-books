"use client";

import { useState, useEffect, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from 'next-intl';
import type { NormalizedBook } from "@/lib/google-books/types";
import type { LibraryEntryView } from "@/features/books/types";
import type { BookStatus } from "@/lib/types/book";
import { BookCard } from "@/features/books/components/book-card";
import { Skeleton } from "@/features/shared/components/skeleton";
import { BookRailSection } from "@/features/shared/ui/book-rail-section";
import { saveBook } from "@/lib/api/books";
import { IsbnScanner } from "@/features/search/components/isbn-scanner";

// ── Helpers ────────────────────────────────────────────────────────────────

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
  // Ensure authors is never empty — Zod rejects min(1)
  const authors = book.authors.length > 0 ? book.authors : ["Unknown"];

  // Separate ISBN-10 from ISBN-13 — don't put a 10-digit ISBN in isbn13
  const isbn = book.isbn ?? null;
  const isbn13 = isbn && isbn.length === 13 ? isbn : undefined;
  const isbn10 = isbn && isbn.length === 10 ? isbn : undefined;

  await saveBook({
    title: book.title,
    authors,
    coverUrl: book.coverUrl ?? undefined,
    publishedDate: book.publishedYear != null ? String(book.publishedYear) : undefined,
    isbn13,
    isbn10,
    status: "WISHLIST" as const,
    genres: book.genres ?? [],
  });
}

/** Shape returned by GET /api/books (UserBookWithBook from the API) */
interface UserBookApiEntry {
  id: string;
  status: BookStatus;
  rating: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  book: {
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
}

const QUICK_FILTERS: { labelKey: string; queryValue: string }[] = [
  { labelKey: "search.genres.novel", queryValue: "Novela" },
  { labelKey: "search.genres.history", queryValue: "Historia" },
  { labelKey: "search.genres.scifi", queryValue: "Ciencia Ficción" },
  { labelKey: "search.genres.romance", queryValue: "Romance" },
  { labelKey: "search.genres.philosophy", queryValue: "Filosofía" },
];

// ── Discover genre label map ─────────────────────────────────────────────────

/** Maps the API genre name to its i18n key under the "discover" namespace. */
const DISCOVER_GENRE_LABEL_KEYS: Record<string, string> = {
  "Fiction": "discover.Fiction",
  "Science Fiction": "discover.Science Fiction",
  "Fantasy": "discover.Fantasy",
  "History": "discover.History",
  "Romance": "discover.Romance",
  "Mystery": "discover.Mystery",
  "Philosophy": "discover.Philosophy",
};

// ── Discover types ───────────────────────────────────────────────────────────

interface DiscoverGenre {
  name: string;
  books: NormalizedBook[];
}

interface DiscoverResponse {
  genres: DiscoverGenre[];
}

// ── Recommendation types ────────────────────────────────────────────────────

interface RecommendedBook {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  isbn13: string | null;
  genres: string[];
}

interface Recommendation {
  book: RecommendedBook;
  readerCount: number;
}

interface RecommendationsResponse {
  recommendations: Recommendation[];
}

// ── Component ───────────────────────────────────────────────────────────────

export default function SearchPage() {
  const t = useTranslations();
  const [query, setQuery] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [results, setResults] = useState<NormalizedBook[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [hasBarcodeApi, setHasBarcodeApi] = useState(false);

  // Feature-detect BarcodeDetector on mount (client only)
  useEffect(() => {
    setHasBarcodeApi(typeof globalThis.BarcodeDetector !== "undefined");
  }, []);

  // Library books indexed by isbn13 for fast lookup
  const [libraryIndex, setLibraryIndex] = useState<Map<string, BookStatus>>(new Map());
  const [librarySuggestions, setLibrarySuggestions] = useState<LibraryEntryView[]>([]);

  // Discover genre carousels
  const [discoverGenres, setDiscoverGenres] = useState<DiscoverGenre[]>([]);
  const [isDiscoverLoading, setIsDiscoverLoading] = useState(true);

  // Social recommendations
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isRecommendationsLoading, setIsRecommendationsLoading] = useState(true);

  // Load user's library on mount to detect already-saved books and show suggestions
  useEffect(() => {
    void fetch("/api/books")
      .then((res) => (res.ok ? res.json() : []))
      .then((entries: UserBookApiEntry[]) => {
        const index = new Map<string, BookStatus>();
        for (const entry of entries) {
          if (entry.book.isbn13) {
            index.set(entry.book.isbn13, entry.status);
          }
        }
        setLibraryIndex(index);
        // Only show READING / TO_READ as "continue reading" suggestions
        // — showing READ books as suggestions makes no sense
        const reading = entries.filter(
          (e) => e.status === "READING" || e.status === "REREADING" || e.status === "TO_READ",
        );
        setLibrarySuggestions(
          reading.map((entry): LibraryEntryView => ({
            ...entry.book,
            status: entry.status,
            rating: entry.rating,
            notes: entry.notes,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
          })),
        );
      })
      .catch(() => {
        // Non-critical — search still works without library data
      });
  }, []);

  // Load discover genre carousels on mount
  useEffect(() => {
    setIsDiscoverLoading(true);
    void fetch("/api/discover/genres")
      .then((res) => (res.ok ? (res.json() as Promise<DiscoverResponse>) : Promise.resolve({ genres: [] })))
      .then((data) => {
        setDiscoverGenres(data.genres);
      })
      .catch(() => {
        // Non-critical — page still works without discover data
      })
      .finally(() => {
        setIsDiscoverLoading(false);
      });
  }, []);

  // Load social recommendations on mount
  useEffect(() => {
    setIsRecommendationsLoading(true);
    void fetch("/api/recommendations")
      .then((res) =>
        res.ok
          ? (res.json() as Promise<RecommendationsResponse>)
          : Promise.resolve({ recommendations: [] }),
      )
      .then((data) => {
        setRecommendations(data.recommendations);
      })
      .catch(() => {
        // Non-critical — page still works without recommendations
      })
      .finally(() => {
        setIsRecommendationsLoading(false);
      });
  }, []);

  function getSavedStatus(book: NormalizedBook): BookStatus | null {
    if (book.isbn) {
      return libraryIndex.get(book.isbn) ?? null;
    }
    return null;
  }

  async function handleSearch(searchQuery: string) {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    setQuery(trimmed);
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/search/books?q=${encodeURIComponent(trimmed)}`);
      const data: unknown = await res.json();

      if (!res.ok) {
        const errData = data as { error?: string };
        setError(errData.error ?? "Search failed. Please try again.");
        setResults([]);
        return;
      }

      setResults(data as NormalizedBook[]);
    } catch {
      setError("Network error. Please check your connection and try again.");
      setResults([]);
    } finally {
      setIsLoading(false);
      setHasSearched(true);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void handleSearch(inputValue);
  }

  function handleIsbnScan(isbn: string) {
    setShowScanner(false);
    setInputValue(isbn);
    void handleSearch(isbn);
  }

  function handleQuickFilter(queryValue: string) {
    setInputValue(queryValue);
    void handleSearch(queryValue);
  }

  async function handleSave(displayBook: LibraryEntryView): Promise<void> {
    const original = results.find((r) => r.externalId === displayBook.id);
    if (!original) return;
    await saveBookToLibrary(original);
    if (original.isbn) {
      setLibraryIndex((prev) => new Map(prev).set(original.isbn!, "WISHLIST"));
    }
  }

  function recommendationToDisplayBook(rec: Recommendation): LibraryEntryView {
    return {
      id: rec.book.id,
      title: rec.book.title,
      subtitle: null,
      authors: rec.book.authors,
      description: null,
      coverUrl: rec.book.coverUrl,
      publisher: null,
      publishedDate: null,
      pageCount: null,
      isbn10: null,
      isbn13: rec.book.isbn13,
      status: "WISHLIST",
      rating: null,
      notes: null,
      genres: rec.book.genres,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async function handleDiscoverSave(displayBook: LibraryEntryView): Promise<void> {
    const original = discoverGenres
      .flatMap((g) => g.books)
      .find((b) => b.externalId === displayBook.id);
    if (!original) return;
    await saveBookToLibrary(original);
    if (original.isbn) {
      setLibraryIndex((prev) => new Map(prev).set(original.isbn!, "WISHLIST"));
    }
  }

  return (
    <div className="pt-8 px-12 md:px-20 pb-24">

      {/* ── Centered header — always visible ── */}
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-5xl font-bold text-on-surface tracking-tight mb-8 font-headline">
          {t('search.heading')}
        </h1>

        {/* Search input */}
        <form
          onSubmit={handleSubmit}
          role="search"
          className="relative w-full max-w-2xl mx-auto"
        >
          <label htmlFor="search-input" className="sr-only">
            {t('search.inputLabel')}
          </label>

          {/* Search icon — left */}
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-6 flex items-center pointer-events-none"
          >
            <span className="material-symbols-outlined text-primary" style={{ fontSize: "22px" }}>
              search
            </span>
          </span>

          <input
            id="search-input"
            name="query"
            type="search"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={t('search.inputLabel')}
            autoComplete="off"
            spellCheck={false}
            disabled={isLoading}
            className="w-full bg-surface-container-lowest border-none text-on-surface placeholder:text-outline text-lg py-5 pl-16 pr-16 rounded-full shadow-2xl focus:ring-2 focus:ring-primary/20 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />

          {/* Scan / Mic button — right */}
          {hasBarcodeApi ? (
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="absolute inset-y-0 right-4 flex items-center text-primary hover:text-primary/80 transition-colors cursor-pointer"
              aria-label={t('search.scanIsbn')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                qr_code_scanner
              </span>
            </button>
          ) : (
            <span
              aria-hidden="true"
              className="absolute inset-y-0 right-4 flex items-center pointer-events-none"
            >
              <span className="material-symbols-outlined text-outline" style={{ fontSize: "22px" }}>
                mic
              </span>
            </span>
          )}
        </form>

        {/* Quick filter pills */}
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          {QUICK_FILTERS.map((filter) => (
            <button
              key={filter.labelKey}
              type="button"
              onClick={() => handleQuickFilter(filter.queryValue)}
              className="px-5 py-2 bg-surface-container-high text-on-surface-variant rounded-full text-sm font-medium hover:bg-surface-bright cursor-pointer transition-colors duration-150"
            >
              {t(filter.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Error state ── */}
      {error != null && (
        <div
          role="alert"
          className="max-w-2xl mx-auto mb-8 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
        >
          {error}
        </div>
      )}

      {/* ── Default state (no active search) ── */}
      {!hasSearched && !isLoading && (
        <>
          {/* ── Genre discovery carousels ── */}
          {(isDiscoverLoading || discoverGenres.length > 0) && (
            <section aria-label={t('discover.heading')} className="mt-16 space-y-12">
              <h2 className="text-xl md:text-2xl font-bold font-headline tracking-tight">
                {t('discover.heading')}
              </h2>

              {/* Skeleton while loading */}
              {isDiscoverLoading && (
                <div
                  className="space-y-12"
                  aria-busy="true"
                  aria-label={t('discover.loadingGenres')}
                >
                  {Array.from({ length: 3 }).map((_, sectionIdx) => (
                    <div key={sectionIdx} className="space-y-4">
                      <Skeleton variant="text" className="h-6 w-40" />
                      <div className="flex gap-6 overflow-hidden">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="shrink-0 space-y-2" style={{ width: "160px" }}>
                            <Skeleton variant="card" className="h-[220px] w-[160px]" />
                            <Skeleton variant="text" className="h-3 w-3/4" />
                            <Skeleton variant="text" className="h-3 w-1/2" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Genre rails */}
              {!isDiscoverLoading &&
                discoverGenres.map((genre) => {
                  const labelKey = DISCOVER_GENRE_LABEL_KEYS[genre.name];
                  const genreLabel = labelKey != null
                    ? t(labelKey as Parameters<typeof t>[0])
                    : genre.name;

                  return (
                    <BookRailSection
                      key={genre.name}
                      title={genreLabel}
                    >
                      {genre.books.map((book, index) => (
                        <BookCard
                          key={book.externalId}
                          variant="search"
                          book={toDisplayBook(book)}
                          index={index}
                          savedStatus={getSavedStatus(book)}
                          onSave={handleDiscoverSave}
                        />
                      ))}
                    </BookRailSection>
                  );
                })}
            </section>
          )}

          {/* ── Social recommendations carousel ── */}
          {(isRecommendationsLoading || recommendations.length > 0) && (
            <section aria-label={t('recommendations.heading')} className="mt-16 space-y-6">
              {isRecommendationsLoading && (
                <div className="space-y-4" aria-busy="true">
                  <Skeleton variant="text" className="h-6 w-56" />
                  <div className="flex gap-6 overflow-hidden">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="shrink-0 space-y-2" style={{ width: "160px" }}>
                        <Skeleton variant="card" className="h-[220px] w-[160px]" />
                        <Skeleton variant="text" className="h-3 w-3/4" />
                        <Skeleton variant="text" className="h-3 w-1/2" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isRecommendationsLoading && recommendations.length > 0 && (
                <BookRailSection title={t('recommendations.heading')}>
                  {recommendations.map((rec, index) => {
                    const displayBook = recommendationToDisplayBook(rec);
                    return (
                      <div key={rec.book.id} className="shrink-0" style={{ width: "160px", minWidth: "160px", scrollSnapAlign: "start" }}>
                        <BookCard
                          variant="browse"
                          book={displayBook}
                          index={index}
                        />
                        <p className="text-xs text-tertiary mt-1 px-1">
                          {t('recommendations.readerCount', { count: rec.readerCount })}
                        </p>
                      </div>
                    );
                  })}
                </BookRailSection>
              )}
            </section>
          )}
        </>
      )}

      {/* ── Loading skeletons ── */}
      {isLoading && (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
          aria-busy="true"
          aria-label={t('search.loading')}
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="grid gap-2">
              <Skeleton variant="card" className="aspect-[2/3] rounded-lg" />
              <Skeleton variant="text" className="h-4 w-3/4" />
              <Skeleton variant="text" className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* ── No results ── */}
      {hasSearched && !isLoading && results.length === 0 && error == null && (
        <div className="flex flex-col items-center gap-4 mt-16 text-center">
          <span
            className="material-symbols-outlined text-on-surface-variant/40"
            style={{ fontSize: "64px" }}
          >
            menu_book
          </span>
          <p className="text-lg font-medium text-on-surface-variant">
            {t('search.noResults', { query })}
          </p>
          <p className="text-sm text-outline">{t('search.tryAnother')}</p>
        </div>
      )}

      {/* ── Results grid ── */}
      {hasSearched && !isLoading && results.length > 0 && (
        <section aria-label={t('search.resultsLabel')} aria-live="polite">
          <p className="text-tertiary text-sm mb-6">
            {t('search.resultsCount', { count: results.length, query })}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {results.map((book, index) => (
              <BookCard
                key={book.externalId}
                variant="search"
                book={toDisplayBook(book)}
                index={index}
                savedStatus={getSavedStatus(book)}
                onSave={handleSave}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── ISBN barcode scanner overlay ── */}
      {showScanner && (
        <IsbnScanner
          onScan={handleIsbnScan}
          onClose={() => setShowScanner(false)}
        />
      )}

    </div>
  );
}
