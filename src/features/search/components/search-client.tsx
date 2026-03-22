"use client";

import { type FormEvent } from "react";
import { useSearchBooks } from "@/features/search/hooks/use-search-books";
import { useLibraryIndex } from "@/features/search/hooks/use-library-index";
import { useSaveBook } from "@/features/books/hooks/use-save-book";
import { toDisplayBook } from "@/features/books/services/book-serializer";
import { BookCard } from "@/features/books/components/book-card";
import { Skeleton } from "@/features/shared/components/skeleton";
import { GenreBentoGrid } from "./genre-bento-grid";
import { LibrarySuggestions } from "./library-suggestions";
import type { NormalizedBook } from "@/lib/google-books/types";
import type { SerializableBook } from "@/features/books/types";

const QUICK_FILTERS = ["Novela", "Historia", "Ciencia Ficción", "Romance", "Filosofía"];

export function SearchClient() {
  const {
    results,
    query,
    inputValue,
    setInputValue,
    search,
    isLoading,
    hasSearched,
    error,
  } = useSearchBooks();

  const { getStatus, suggestions, markSaved } = useLibraryIndex();
  const { save } = useSaveBook();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void search(inputValue);
  }

  function handleQuickFilter(genre: string) {
    setInputValue(genre);
    void search(genre);
  }

  function getSavedStatus(book: NormalizedBook) {
    return getStatus(book.isbn ?? null);
  }

  async function handleSave(displayBook: SerializableBook): Promise<void> {
    const original = results.find((r) => r.externalId === displayBook.id);
    if (!original) return;
    await save(original);
    if (original.isbn) {
      markSaved(original.isbn);
    }
  }

  return (
    <main className="lg:ml-64 pt-24 px-6 md:px-12 pb-24">

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
          <GenreBentoGrid onGenreClick={handleQuickFilter} />
          <LibrarySuggestions books={suggestions} />
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

    </main>
  );
}
