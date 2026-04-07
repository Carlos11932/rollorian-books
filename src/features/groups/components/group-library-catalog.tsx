"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BookRailSection } from "@/features/shared/ui/book-rail-section";
import { EmptyState } from "@/features/shared/components/empty-state";
import { GroupBookCard } from "./group-book-card";
import { groupByNormalizedGenre } from "@/lib/book-providers/genre-normalizer";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CatalogBook {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  genres: string[];
  currentUserStatus: string | null;
  isRead: boolean;
}

type ViewMode = "genre" | "all";
type ReadFilter = "all" | "read" | "unread";

interface GroupLibraryCatalogProps {
  books: CatalogBook[];
}

// ---------------------------------------------------------------------------
// Filter pill component
// ---------------------------------------------------------------------------

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center px-4 py-2 rounded-full text-sm font-bold transition-all duration-200",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
        active
          ? "bg-gradient-to-br from-accent to-accent-strong text-white border border-transparent"
          : "bg-white/6 text-muted border border-white/12 hover:text-text hover:-translate-y-px",
      )}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GroupLibraryCatalog({ books }: GroupLibraryCatalogProps) {
  const t = useTranslations("groups");
  const [viewMode, setViewMode] = useState<ViewMode>("genre");
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");

  // Apply read filter
  const filteredBooks =
    readFilter === "read"
      ? books.filter((b) => b.isRead)
      : readFilter === "unread"
        ? books.filter((b) => !b.isRead)
        : books;

  // Group by normalized genre for the genre view
  const genreSections = groupByNormalizedGenre(filteredBooks, t("noGenre"));

  // Empty states
  if (books.length === 0) {
    return (
      <EmptyState
        title={t("emptyCatalog")}
        description={t("emptyCatalogDescription")}
      />
    );
  }

  if (filteredBooks.length === 0) {
    return (
      <>
        <CatalogFilters
          viewMode={viewMode}
          readFilter={readFilter}
          onViewModeChange={setViewMode}
          onReadFilterChange={setReadFilter}
        />
        <EmptyState title={t("emptyFiltered")} />
      </>
    );
  }

  return (
    <div className="grid gap-6">
      <CatalogFilters
        viewMode={viewMode}
        readFilter={readFilter}
        onViewModeChange={setViewMode}
        onReadFilterChange={setReadFilter}
      />

      {viewMode === "genre" ? (
        <div className="grid gap-8">
          {genreSections.map(([genre, genreBooks]) => (
            <BookRailSection
              key={genre}
              title={genre}
              count={genreBooks.length}
            >
              {genreBooks.map((book, i) => (
                <GroupBookCard key={book.id} book={book} index={i} />
              ))}
            </BookRailSection>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,118px)] gap-4 justify-center">
          {filteredBooks.map((book, i) => (
            <GroupBookCard key={book.id} book={book} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filters bar
// ---------------------------------------------------------------------------

function CatalogFilters({
  viewMode,
  readFilter,
  onViewModeChange,
  onReadFilterChange,
}: {
  viewMode: ViewMode;
  readFilter: ReadFilter;
  onViewModeChange: (v: ViewMode) => void;
  onReadFilterChange: (f: ReadFilter) => void;
}) {
  const t = useTranslations("groups");

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* View mode toggle */}
      <div className="flex gap-1.5">
        <FilterPill
          label={t("viewByGenre")}
          active={viewMode === "genre"}
          onClick={() => onViewModeChange("genre")}
        />
        <FilterPill
          label={t("viewAll")}
          active={viewMode === "all"}
          onClick={() => onViewModeChange("all")}
        />
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-line" aria-hidden="true" />

      {/* Read filter */}
      <div className="flex gap-1.5">
        <FilterPill
          label={t("filterAll")}
          active={readFilter === "all"}
          onClick={() => onReadFilterChange("all")}
        />
        <FilterPill
          label={t("filterRead")}
          active={readFilter === "read"}
          onClick={() => onReadFilterChange("read")}
        />
        <FilterPill
          label={t("filterUnread")}
          active={readFilter === "unread"}
          onClick={() => onReadFilterChange("unread")}
        />
      </div>
    </div>
  );
}
