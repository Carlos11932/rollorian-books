"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { BookStatus } from "@/lib/types/book";
import { StatusTabs, type StatusCounts, type StatusTabValue } from "./status-tabs";
import { LibraryBookCard, type LibraryBook } from "./library-book-card";
import { SelectionToolbar } from "./selection-toolbar";
import { BookRailSection } from "@/features/shared/ui/book-rail-section";
import { EmptyState } from "@/features/shared/components/empty-state";
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
// Section visibility persistence (localStorage)
// ---------------------------------------------------------------------------

const VISIBILITY_STORAGE_KEY = "library-section-visibility";

type VisibilityMap = Partial<Record<string, boolean>>;

function loadVisibility(): VisibilityMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(VISIBILITY_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as VisibilityMap) : {};
  } catch {
    return {};
  }
}

function saveVisibility(visibility: VisibilityMap): void {
  try {
    localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(visibility));
  } catch {
    // localStorage unavailable — silent fail
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LibraryView({
  books,
  counts,
  activeStatus,
  searchParams,
}: LibraryViewProps) {
  const router = useRouter();
  const t = useTranslations();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Section visibility — starts with all-visible (matches SSR).
  // On mount, reads from localStorage. No hydration mismatch because
  // initial state matches server output.
  const [sectionVisibility, setSectionVisibility] = useState<VisibilityMap>({});
  const [mounted, setMounted] = useState(false);

  // Sync from localStorage ONLY after first client render
  if (typeof window !== "undefined" && !mounted) {
    const stored = loadVisibility();
    if (Object.keys(stored).length > 0) {
      setSectionVisibility(stored);
    }
    setMounted(true);
  }

  function toggleSectionVisibility(status: BookStatus) {
    setSectionVisibility((prev) => {
      const next = { ...prev, [status]: !(prev[status] ?? true) };
      saveVisibility(next);
      return next;
    });
  }

  function isSectionVisible(status: BookStatus): boolean {
    return sectionVisibility[status] ?? true;
  }

  // Toggle selection of a single book
  const toggleSelect = useCallback((bookId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) {
        next.delete(bookId);
      } else {
        next.add(bookId);
      }
      return next;
    });
  }, []);

  // Exit selection mode
  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  // Batch status change via API
  async function handleBatchStatusChange(status: BookStatus) {
    if (selectedIds.size === 0) return;

    const res = await fetch("/api/books/batch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookIds: Array.from(selectedIds),
        status,
      }),
    });

    if (res.ok) {
      exitSelectionMode();
      router.refresh();
    }
  }

  // Select / deselect all visible books
  function selectAll() {
    setSelectedIds(new Set(books.map((b) => b.id)));
  }

  const isEmpty = books.length === 0;

  function getFilterTitle(status: BookStatus): string {
    return `No ${t(`book.status.${status}`)} books`;
  }

  return (
    <div className="grid gap-6">
      {/* Header card */}
      <div
        className="card-glass backdrop-blur-xl p-6 grid gap-4"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Library</p>
            <h1
              className="text-3xl font-bold text-text"
            >
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
              onClick={selectionMode ? exitSelectionMode : () => setSelectionMode(true)}
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
              onClick={selectAll}
              className="text-xs text-accent font-bold hover:underline"
            >
              {t("library.selectAll")}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
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
          onDeselectAll={() => setSelectedIds(new Set())}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card wrapper with selection overlay
// ---------------------------------------------------------------------------

function BookCardWithSelection({
  book,
  selectionMode,
  selected,
  onToggle,
}: {
  book: LibraryBook;
  selectionMode: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  if (!selectionMode) {
    return <LibraryBookCard book={book} />;
  }

  return (
    <div
      className={cn(
        "relative cursor-pointer transition-all duration-150",
        selected && "ring-2 ring-accent rounded-[var(--radius-md)]",
      )}
      onClick={() => onToggle(book.id)}
      role="checkbox"
      aria-checked={selected}
      aria-label={`${selected ? "Deselect" : "Select"} ${book.title}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onToggle(book.id);
        }
      }}
    >
      <LibraryBookCard book={book} />

      {/* Checkbox overlay */}
      <div
        className={cn(
          "absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-150",
          selected
            ? "bg-accent border-accent text-white"
            : "bg-black/40 border-white/40 text-transparent",
        )}
      >
        <span className="material-symbols-outlined text-[14px]">check</span>
      </div>
    </div>
  );
}
