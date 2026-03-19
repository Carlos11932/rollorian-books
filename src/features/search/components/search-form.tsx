"use client";

import { useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/features/shared/components/button";

interface SearchFormProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
  initialQuery?: string;
}

export function SearchForm({ onSearch, isLoading = false, initialQuery = "" }: SearchFormProps) {
  const [query, setQuery] = useState(initialQuery);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    onSearch(trimmed);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 w-full max-w-2xl mx-auto"
      role="search"
    >
      <label htmlFor="search-input" className="sr-only">
        Search books by title, author, or ISBN
      </label>
      <div className="relative flex items-center">
        {/* Search icon */}
        <span
          className="absolute left-4 text-muted pointer-events-none"
          aria-hidden="true"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>

        <input
          id="search-input"
          name="query"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try Dune, Le Guin, or 9780261103573"
          autoComplete="off"
          spellCheck={false}
          disabled={isLoading}
          className={cn(
            "w-full pl-12 pr-4 py-4 rounded-full border border-line bg-surface",
            "text-text placeholder:text-muted text-base",
            "focus:outline-none focus:border-accent/60 focus:bg-surface-strong",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            "transition-colors duration-150",
          )}
        />
      </div>

      <div className="flex gap-3 justify-center">
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={isLoading}
          disabled={!query.trim() || isLoading}
        >
          {isLoading ? "Searching..." : "Search"}
        </Button>
        {query && !isLoading && (
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => setQuery("")}
          >
            Clear
          </Button>
        )}
      </div>
    </form>
  );
}
