"use client";

import { useState } from "react";
import { SearchForm } from "@/features/search/components/search-form";
import { SearchResultsGrid } from "@/features/search/components/search-results-grid";
import type { NormalizedBook } from "@/lib/google-books/types";

const SEARCH_PAGE_COPY = {
  eyebrow: "Search",
  heading: "Search the catalog",
  subheading: "Search the external catalog, then save straight into your own archive.",
} as const;

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NormalizedBook[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(searchQuery: string) {
    setQuery(searchQuery);
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/search/books?q=${encodeURIComponent(searchQuery)}`);
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

  return (
    <div className="grid gap-6">
      {/* Page header + search form */}
      <div
        className="rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] p-6 grid gap-6"
        style={{ backdropFilter: "blur(16px)" }}
      >
        <div className="grid gap-1 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">
            {SEARCH_PAGE_COPY.eyebrow}
          </p>
          <h1
            className="text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {SEARCH_PAGE_COPY.heading}
          </h1>
          <p className="text-sm text-muted leading-relaxed max-w-lg mx-auto">
            {SEARCH_PAGE_COPY.subheading}
          </p>
        </div>

        <SearchForm
          onSearch={handleSearch}
          isLoading={isLoading}
          initialQuery={query}
        />
      </div>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="rounded-[var(--radius-md)] border border-danger/30 bg-danger/8 px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      )}

      {/* Results section */}
      <section
        className="rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] p-6 grid gap-4"
        style={{ backdropFilter: "blur(16px)" }}
        aria-label="Search results"
        aria-live="polite"
      >
        <header className="flex items-end justify-between gap-4">
          <div className="grid gap-0.5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">
              Results
            </p>
            <h2
              className="text-2xl font-bold text-text"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {hasSearched && !isLoading
                ? results.length > 0
                  ? "Candidate books"
                  : "No results"
                : "Candidate books"}
            </h2>
          </div>
          {hasSearched && !isLoading && results.length > 0 && (
            <span className="text-sm text-muted tabular-nums shrink-0">
              {results.length} {results.length === 1 ? "result" : "results"}
            </span>
          )}
        </header>

        <SearchResultsGrid
          results={results}
          isLoading={isLoading}
          hasSearched={hasSearched}
        />
      </section>
    </div>
  );
}
