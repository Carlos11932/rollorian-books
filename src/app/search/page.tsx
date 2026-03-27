"use client";

import { useState, useEffect, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import type { NormalizedBook } from "@/lib/google-books/types";
import type { SerializableBook } from "@/features/books/types";
import type { BookStatus } from "@/lib/types/book";
import { BookCard } from "@/features/books/components/book-card";
import { Skeleton } from "@/features/shared/components/skeleton";
import { saveBook } from "@/lib/api/books";

// ── Helpers ────────────────────────────────────────────────────────────────

function toDisplayBook(book: NormalizedBook): SerializableBook {
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
  await saveBook({
    title: book.title,
    authors: book.authors,
    coverUrl: book.coverUrl ?? undefined,
    publishedDate: book.publishedYear != null ? String(book.publishedYear) : undefined,
    isbn13: book.isbn ?? undefined,
    status: "WISHLIST" as const,
    genres: [],
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

// ── Genre bento data ────────────────────────────────────────────────────────

const GENRES = [
  {
    label: "Historia",
    icon: "history_edu",
    span: "md:col-span-2 md:row-span-2",
    labelTag: "Anthology",
  },
  {
    label: "Romance",
    icon: "favorite",
    span: "md:col-span-1 md:row-span-1",
    labelTag: null,
  },
  {
    label: "Ciencia Ficción",
    icon: "rocket_launch",
    span: "md:col-span-1 md:row-span-1",
    labelTag: null,
  },
  {
    label: "Filosofía",
    icon: "psychology",
    span: "md:col-span-1 md:row-span-1",
    labelTag: null,
  },
  {
    label: "Misterio",
    icon: "search",
    span: "md:col-span-1 md:row-span-1",
    labelTag: null,
  },
];

const QUICK_FILTERS = ["Novela", "Historia", "Ciencia Ficción", "Romance", "Filosofía"];

// ── Component ───────────────────────────────────────────────────────────────

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [results, setResults] = useState<NormalizedBook[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Library books indexed by isbn13 for fast lookup
  const [libraryIndex, setLibraryIndex] = useState<Map<string, BookStatus>>(new Map());
  const [librarySuggestions, setLibrarySuggestions] = useState<SerializableBook[]>([]);

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
        // Flatten UserBook + Book into SerializableBook shape for suggestions
        setLibrarySuggestions(
          entries.map((entry): SerializableBook => ({
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

  function handleQuickFilter(genre: string) {
    setInputValue(genre);
    void handleSearch(genre);
  }

  async function handleSave(displayBook: SerializableBook): Promise<void> {
    const original = results.find((r) => r.externalId === displayBook.id);
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
          Explore the Archive
        </h1>

        {/* Search input */}
        <form
          onSubmit={handleSubmit}
          role="search"
          className="relative w-full max-w-2xl mx-auto"
        >
          <label htmlFor="search-input" className="sr-only">
            Busca por título, autor o ISBN
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
            placeholder="Busca por título, autor o ISBN"
            autoComplete="off"
            spellCheck={false}
            disabled={isLoading}
            className="w-full bg-surface-container-lowest border-none text-on-surface placeholder:text-outline text-lg py-5 pl-16 pr-16 rounded-full shadow-2xl focus:ring-2 focus:ring-primary/20 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />

          {/* Mic button — right (visual only) */}
          <span
            aria-hidden="true"
            className="absolute inset-y-0 right-4 flex items-center pointer-events-none"
          >
            <span className="material-symbols-outlined text-outline" style={{ fontSize: "22px" }}>
              mic
            </span>
          </span>
        </form>

        {/* Quick filter pills */}
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          {QUICK_FILTERS.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => handleQuickFilter(genre)}
              className="px-5 py-2 bg-surface-container-high text-on-surface-variant rounded-full text-sm font-medium hover:bg-surface-bright cursor-pointer transition-colors duration-150"
            >
              {genre}
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
          {/* Bento grid of genres */}
          <section className="mb-16" aria-label="Géneros">
            <div className="grid grid-cols-1 md:grid-cols-4 grid-rows-2 gap-4 h-auto md:h-[450px]">
              {GENRES.map((genre) => (
                <button
                  key={genre.label}
                  type="button"
                  onClick={() => handleQuickFilter(genre.label)}
                  className={[
                    genre.span,
                    "rounded-xl overflow-hidden relative group cursor-pointer bg-surface-container-low text-left",
                  ].join(" ")}
                >
                  {/* Background icon — decorative */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span
                      className="material-symbols-outlined text-primary/20"
                      style={{ fontSize: "96px" }}
                    >
                      {genre.icon}
                    </span>
                  </div>

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />

                  {/* Text content */}
                  <div className="absolute bottom-0 p-6">
                    {genre.labelTag != null && (
                      <span className="block text-xs font-semibold text-secondary uppercase tracking-widest mb-1">
                        {genre.labelTag}
                      </span>
                    )}
                    <span className="text-xl font-bold text-primary font-headline">
                      {genre.label}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Archived Suggestions */}
          {librarySuggestions.length > 0 && (
            <section aria-label="Archived Suggestions">
              <h2 className="text-xl md:text-2xl font-bold font-headline tracking-tight mb-8">
                Archived Suggestions
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {librarySuggestions.map((book) => (
                  <Link
                    key={book.id}
                    href={`/books/${book.id}`}
                    className="group relative block rounded-lg overflow-hidden cursor-pointer"
                    aria-label={`${book.title}${book.authors.length > 0 ? ` — ${book.authors.join(", ")}` : ""}`}
                  >
                    {/* Portrait cover */}
                    <div className="aspect-[2/3] rounded-lg overflow-hidden bg-surface-container-high relative">
                      {book.coverUrl != null ? (
                        <Image
                          src={book.coverUrl}
                          alt={book.title}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-300 shadow-xl"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span
                            className="material-symbols-outlined text-on-surface-variant/40"
                            style={{ fontSize: "48px" }}
                          >
                            menu_book
                          </span>
                        </div>
                      )}

                      {/* Bookmark button */}
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-hidden="true"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-surface-container-highest/90 p-2 rounded-full text-secondary"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                          bookmark
                        </span>
                      </button>
                    </div>

                    {/* Book info */}
                    <div className="pt-2 px-1">
                      <p
                        className="text-on-surface font-bold text-sm truncate mb-1"
                        title={book.title}
                      >
                        {book.title}
                      </p>
                      <p className="text-on-surface-variant text-xs truncate">
                        {book.authors.length > 0 ? book.authors.join(", ") : "Autor desconocido"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ── Loading skeletons ── */}
      {isLoading && (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
          aria-busy="true"
          aria-label="Cargando resultados"
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
            No encontramos nada para &ldquo;{query}&rdquo;
          </p>
          <p className="text-sm text-outline">Prueba con otro título, autor o ISBN</p>
        </div>
      )}

      {/* ── Results grid ── */}
      {hasSearched && !isLoading && results.length > 0 && (
        <section aria-label="Resultados de búsqueda" aria-live="polite">
          <p className="text-tertiary text-sm mb-6">
            {results.length} {results.length === 1 ? "resultado" : "resultados"} para &laquo;{query}&raquo;
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

    </div>
  );
}
