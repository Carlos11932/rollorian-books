"use client";

import { useState, useEffect, type FormEvent } from "react";
import type { NormalizedBook } from "@/lib/google-books/types";
import type { SerializableBook } from "@/features/books/types";
import type { BookStatus } from "@/lib/types/book";
import { BookCard } from "@/features/books/components/book-card";
import { Skeleton } from "@/features/shared/components/skeleton";

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
  const payload = {
    title: book.title,
    authors: book.authors,
    coverUrl: book.coverUrl ?? undefined,
    publishedDate: book.publishedYear != null ? String(book.publishedYear) : undefined,
    isbn13: book.isbn ?? undefined,
    status: "WISHLIST" as const,
    genres: [],
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

interface LibraryBookEntry {
  isbn13: string | null;
  status: BookStatus;
}

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

  const backgroundUrl = results.length > 0 ? (results[0]?.coverUrl ?? null) : null;

  // Load user's library on mount to detect already-saved books
  useEffect(() => {
    void fetch("/api/books")
      .then((res) => res.ok ? res.json() : [])
      .then((books: LibraryBookEntry[]) => {
        const index = new Map<string, BookStatus>();
        for (const book of books) {
          if (book.isbn13) {
            index.set(book.isbn13, book.status);
          }
        }
        setLibraryIndex(index);
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

  async function handleSave(displayBook: SerializableBook): Promise<void> {
    const original = results.find((r) => r.externalId === displayBook.id);
    if (!original) return;
    await saveBookToLibrary(original);
    // Update local library index so the card updates without a reload
    if (original.isbn) {
      setLibraryIndex((prev) => new Map(prev).set(original.isbn!, "WISHLIST"));
    }
  }

  return (
    <div className="relative min-h-screen">

      {/* ── Blurred background wallpaper ── */}
      {backgroundUrl != null ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(80px) brightness(0.25) saturate(1.5)",
            transform: "scale(1.2)",
          }}
        />
      ) : (
        <div className="fixed inset-0 z-0 bg-surface pointer-events-none" aria-hidden="true" />
      )}

      {/* Dark overlay */}
      <div className="fixed inset-0 z-0 bg-surface/50 pointer-events-none" aria-hidden="true" />

      {/* ── Page content ── */}
      <div className="relative z-10 px-6 md:px-12 lg:px-20 pb-24 pt-12">

        {/* Header */}
        <div className="text-center mb-10">
          <h1
            className="text-4xl md:text-5xl font-bold text-on-surface tracking-tight"
            style={{ fontFamily: "var(--font-headline)" }}
          >
            Buscar libros
          </h1>
        </div>

        {/* ── Search input ── */}
        <form
          onSubmit={handleSubmit}
          role="search"
          className="flex flex-col items-center gap-4 w-full max-w-2xl mx-auto mb-12"
        >
          <label htmlFor="search-input" className="sr-only">
            Busca por título, autor o ISBN
          </label>

          <div className="relative w-full">
            {/* Search icon */}
            <span
              aria-hidden="true"
              className="absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none text-white/40"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
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
              className={[
                "w-full pl-14 pr-5 py-4 rounded-2xl",
                "bg-white/5 backdrop-blur-md border border-white/10",
                "text-on-surface placeholder:text-white/40 text-base",
                "focus:outline-none focus:border-primary focus:bg-white/8",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-colors duration-150",
              ].join(" ")}
            />
          </div>

          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className={[
              "px-8 py-3 rounded-xl font-semibold text-sm",
              "bg-primary text-on-primary",
              "hover:bg-primary-fixed-dim transition-colors duration-150",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              "focus:outline-none focus:ring-2 focus:ring-primary/50",
            ].join(" ")}
          >
            {isLoading ? "Buscando..." : "Buscar"}
          </button>
        </form>

        {/* ── Error state ── */}
        {error != null && (
          <div
            role="alert"
            className="max-w-2xl mx-auto mb-8 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
          >
            {error}
          </div>
        )}

        {/* ── Initial state ── */}
        {!hasSearched && !isLoading && (
          <div className="flex flex-col items-center gap-4 mt-16 text-center text-white/40">
            <span className="material-symbols-outlined" style={{ fontSize: "64px" }}>
              search
            </span>
            <p className="text-lg font-medium">Busca tu próxima lectura</p>
            <p className="text-sm text-white/30 max-w-xs">
              Explora millones de libros por título, autor o ISBN
            </p>
          </div>
        )}

        {/* ── Loading skeletons ── */}
        {isLoading && (
          <div
            className="grid gap-5"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
            aria-busy="true"
            aria-label="Cargando resultados"
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid gap-2">
                <Skeleton variant="card" className="h-[220px]" />
                <Skeleton variant="text" className="h-4 w-3/4" />
                <Skeleton variant="text" className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* ── No results ── */}
        {hasSearched && !isLoading && results.length === 0 && error == null && (
          <div className="flex flex-col items-center gap-4 mt-16 text-center">
            <span className="material-symbols-outlined text-white/30" style={{ fontSize: "64px" }}>
              menu_book
            </span>
            <p className="text-lg font-medium text-white/60">
              No hemos encontrado nada para &ldquo;{query}&rdquo;
            </p>
            <p className="text-sm text-white/30">
              Prueba con otro título, autor o ISBN
            </p>
          </div>
        )}

        {/* ── Results grid ── */}
        {hasSearched && !isLoading && results.length > 0 && (
          <section aria-label="Resultados de búsqueda" aria-live="polite">
            <p className="text-sm text-white/50 mb-6 font-medium">
              {results.length} {results.length === 1 ? "resultado" : "resultados"} para &ldquo;{query}&rdquo;
            </p>
            <div
              className="grid gap-5"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
            >
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
    </div>
  );
}
