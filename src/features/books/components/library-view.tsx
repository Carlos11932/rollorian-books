"use client";

import { useTranslations } from "next-intl";
import type { BookStatus } from "@/lib/types/book";
import { StatusTabs, type StatusCounts, type StatusTabValue } from "./status-tabs";
import { type LibraryBook } from "./library-book-card";
import { BookCardWithSelection } from "./book-card-with-selection";
import { SelectionToolbar } from "./selection-toolbar";
import { BookRailSection } from "@/features/shared/ui/book-rail-section";
import { EmptyState } from "@/features/shared/components/empty-state";
import { useLibraryVisibility } from "../hooks/use-library-visibility";
import { useBatchSelection } from "../hooks/use-batch-selection";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LibraryViewProps {
  books: LibraryBook[];
  counts: StatusCounts;
  activeStatus: StatusTabValue;
  searchParams: Record<string, string>;
}

// Issue #34: Preferred order — Reading, Rereading, Wishlist, To Read, On Hold, Read
const STATUS_ORDERED: BookStatus[] = [
  "READING", "REREADING", "WISHLIST", "TO_READ", "ON_HOLD", "READ",
];

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
  const { isSectionVisible, toggleSectionVisibility } = useLibraryVisibility();
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

  const isEmpty = books.length === 0;

  function getFilterTitle(status: BookStatus): string {
    return `No ${t(`book.status.${status}`)} books`;
  }

  return (
    <div className="grid gap-6">
      {/* Header card */}
      <div className="card-glass backdrop-blur-xl p-6 grid gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Library</p>
            <h1 className="text-3xl font-bold text-text">
              {t("library.heading")}
            </h1>
            <p className="text-sm text-muted leading-relaxed max-w-lg">
              {t("library.description")}
            </p>
          </div>

          {/* Selection toggle button */}
          {!isEmpty && (
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
              onClick={() => selectAll(books)}
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

        <StatusTabs activeStatus={activeStatus} counts={counts} searchParams={searchParams} />
      </div>

      {/* Book content */}
      {isEmpty ? (
        <EmptyState
          title={
            activeStatus === "all"
              ? t("library.emptyAll")
              : getFilterTitle(activeStatus as BookStatus)
          }
          description={
            activeStatus === "all"
              ? t("library.searchPlaceholder")
              : t("library.tryAnotherStatus")
          }
        />
      ) : activeStatus !== "all" ? (
        <BookRailSection
          title={t(`library.statusEyebrow.${activeStatus}`)}
          eyebrow={t(`book.status.${activeStatus}`)}
          count={books.length}
          emptyCopy={t("library.emptyFilter")}
        >
          {books.map((book) => (
            <div
              key={book.id}
              className="shrink-0 w-[clamp(260px,32vw,340px)]"
              style={{ scrollSnapAlign: "start" }}
            >
              <BookCardWithSelection
                book={book}
                selectionMode={selectionMode}
                selected={selectedIds.has(book.id)}
                onToggle={toggleSelect}
              />
            </div>
          ))}
        </BookRailSection>
      ) : (
        <div className="grid gap-4">
          {STATUS_ORDERED.map((status) => {
            const statusBooks = books.filter((b) => b.status === status);
            // Issue #34: hide empty sections
            if (statusBooks.length === 0) return null;
            const visible = isSectionVisible(status);

            return (
              <div key={status}>
                {/* Section header with toggle */}
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-muted uppercase tracking-wider">
                    {t(`library.statusEyebrow.${status}`)}
                    <span className="ml-2 text-xs font-normal text-muted/60">
                      {statusBooks.length}
                    </span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => toggleSectionVisibility(status)}
                    className="text-muted hover:text-text transition-colors p-1"
                    aria-label={`${visible ? t("library.hideSection") : t("library.showSection")} — ${t(`library.statusEyebrow.${status}`)}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {visible ? "visibility" : "visibility_off"}
                    </span>
                  </button>
                </div>

                {visible && (
                  <BookRailSection
                    title={t(`book.status.${status}`)}
                    count={statusBooks.length}
                  >
                    {statusBooks.map((book) => (
                      <div
                        key={book.id}
                        className="shrink-0 w-[clamp(260px,32vw,340px)]"
                        style={{ scrollSnapAlign: "start" }}
                      >
                        <BookCardWithSelection
                          book={book}
                          selectionMode={selectionMode}
                          selected={selectedIds.has(book.id)}
                          onToggle={toggleSelect}
                        />
                      </div>
                    ))}
                  </BookRailSection>
                )}
              </div>
            );
          })}
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
