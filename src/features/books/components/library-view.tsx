"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { BookStatus, OwnershipStatus } from "@/lib/types/book";
import { OWNERSHIP_STATUS_VALUES } from "@/lib/types/book";
import { StatusTabs, type StatusCounts, type StatusTabValue } from "./status-tabs";
import { LibraryBookRow } from "./library-book-row";
import { SelectionToolbar } from "./selection-toolbar";
import { EmptyState } from "@/features/shared/components/empty-state";
import { useBatchSelection } from "../hooks/use-batch-selection";
import { cn } from "@/lib/cn";
import type { LibraryEntryView } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LibraryViewProps {
  books: LibraryEntryView[];
  counts: StatusCounts;
  activeStatus: StatusTabValue;
  searchParams: Record<string, string>;
}

type OwnershipFilterValue = OwnershipStatus | "ALL";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LibraryView({
  books,
  counts,
  activeStatus,
  searchParams,
}: LibraryViewProps) {
  const t = useTranslations();
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilterValue>("ALL");

  const {
    selectionMode,
    selectedIds,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelect,
    selectAll,
    deselectAll,
    handleBatchStatusChange,
  } = useBatchSelection();

  // Apply ownership filter on top of status-filtered books
  const filteredBooks =
    ownershipFilter === "ALL"
      ? books
      : books.filter((b) => b.ownershipStatus === ownershipFilter);

  const isEmpty = filteredBooks.length === 0;

  return (
    <div className="grid gap-6">
      {/* Header card */}
      <div className="card-glass backdrop-blur-xl p-6 grid gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">
              {t("nav.library")}
            </p>
            <h1 className="text-3xl font-bold text-text">
              {t("library.heading")}
            </h1>
            <p className="text-sm text-muted leading-relaxed max-w-lg">
              {t("library.description")}
            </p>
          </div>

          {/* Selection toggle button */}
          {books.length > 0 && (
            <button
              type="button"
              onClick={selectionMode ? exitSelectionMode : enterSelectionMode}
              className={cn(
                "shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all duration-200",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
                selectionMode
                  ? "bg-accent/15 text-accent border border-accent/30"
                  : "bg-white/10 text-text border border-line hover:-translate-y-px",
              )}
            >
              <span className="material-symbols-outlined text-[16px]">
                {selectionMode ? "close" : "checklist"}
              </span>
              {selectionMode ? t("library.cancelSelection") : t("library.select")}
            </button>
          )}
        </div>

        {/* Select all / deselect all — only in selection mode */}
        {selectionMode && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => selectAll(filteredBooks)}
              className="text-xs text-accent font-bold hover:underline"
            >
              {t("library.selectAll")}
            </button>
            <button
              type="button"
              onClick={deselectAll}
              className="text-xs text-muted font-bold hover:underline"
            >
              {t("library.deselectAll")}
            </button>
          </div>
        )}

        {/* Reading status tabs */}
        <StatusTabs
          activeStatus={activeStatus}
          counts={counts}
          searchParams={searchParams}
        />

        {/* Ownership filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted uppercase tracking-wider mr-1">
            {t("book.ownershipLabel")}:
          </span>

          {/* "All" chip */}
          <button
            type="button"
            onClick={() => setOwnershipFilter("ALL")}
            className={cn(
              "inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border transition-all duration-150",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
              ownershipFilter === "ALL"
                ? "bg-white/12 text-text border-white/20"
                : "bg-white/5 text-muted border-white/8 hover:text-text hover:border-white/15",
            )}
          >
            {t("library.ownershipFilter.ALL")}
          </button>

          {/* Status-specific chips */}
          {OWNERSHIP_STATUS_VALUES.map((os) => (
            <button
              key={os}
              type="button"
              onClick={() => setOwnershipFilter(os)}
              className={cn(
                "inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border transition-all duration-150",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
                ownershipFilter === os
                  ? os === "OWNED"
                    ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/35"
                    : os === "NOT_OWNED"
                      ? "bg-white/12 text-text border-white/20"
                      : "bg-white/8 text-white/60 border-white/12"
                  : os === "OWNED"
                    ? "bg-emerald-500/8 text-emerald-500/60 border-emerald-500/12 hover:bg-emerald-500/15 hover:text-emerald-400"
                    : "bg-white/5 text-muted border-white/8 hover:text-text hover:border-white/15",
              )}
            >
              {t(`library.ownershipFilter.${os}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Book list */}
      {isEmpty ? (
        <EmptyState
          title={
            books.length === 0
              ? activeStatus === "all"
                ? t("library.emptyAll")
                : t("library.emptyFilter")
              : t("library.emptyFilter")
          }
          description={
            books.length === 0 && activeStatus === "all"
              ? t("library.searchPlaceholder")
              : t("library.tryAnotherStatus")
          }
        />
      ) : (
        <div className="grid gap-2">
          {filteredBooks.map((book) => (
            <LibraryBookRow
              key={book.id}
              book={book}
              selectionMode={selectionMode}
              selected={selectedIds.has(book.id)}
              onToggle={toggleSelect}
            />
          ))}
        </div>
      )}

      {/* Floating selection toolbar */}
      {selectionMode && selectedIds.size > 0 && (
        <SelectionToolbar
          selectedCount={selectedIds.size}
          onBatchStatusChange={handleBatchStatusChange}
          onDeselectAll={deselectAll}
        />
      )}
    </div>
  );
}
