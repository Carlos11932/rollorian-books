"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { BookCover } from "./book-cover";
import { Badge } from "@/features/shared/components/badge";
import { OwnershipBadge } from "@/features/shared/components/ownership-badge";
import { type BookStatus, BOOK_STATUS_VALUES } from "@/lib/types/book";
import { cn } from "@/lib/cn";
import { updateBook, deleteBook } from "@/lib/api/books";
import type { LibraryEntryView } from "../types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LibraryBookRowProps {
  book: LibraryEntryView;
  selectionMode?: boolean;
  selected?: boolean;
  onToggle?: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LibraryBookRow({
  book,
  selectionMode = false,
  selected = false,
  onToggle,
}: LibraryBookRowProps) {
  const router = useRouter();
  const t = useTranslations();

  const [status, setStatus] = useState<BookStatus>(book.status);
  const [isStatusLoading, setIsStatusLoading] = useState(false);

  useEffect(() => { setStatus(book.status); }, [book.status]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const authorLine =
    book.authors.length > 0 ? book.authors.join(", ") : t("common.unknownAuthor");

  async function handleStatusChange(newStatus: BookStatus) {
    if (newStatus === status) return;
    setIsStatusLoading(true);
    setStatus(newStatus);
    try {
      await updateBook(book.id, { status: newStatus });
      router.refresh();
    } catch {
      setStatus(book.status);
    } finally {
      setIsStatusLoading(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await deleteBook(book.id);
      router.refresh();
    } catch {
      // silent — refresh will show current state
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  function handleRowClick() {
    if (selectionMode && onToggle) {
      onToggle(book.id);
    }
  }

  return (
    <article
      className={cn(
        "group relative flex gap-3 sm:gap-4 rounded-[var(--radius-md)] border border-line p-3 sm:p-4",
        "bg-gradient-to-br from-[rgba(19,27,41,0.82)] to-[rgba(8,12,20,0.82)]",
        "backdrop-blur-[12px] transition-all duration-200",
        "hover:border-white/18 hover:from-[rgba(19,27,41,0.92)] hover:to-[rgba(8,12,20,0.92)]",
        "hover:shadow-[0_4px_24px_rgba(0,0,0,0.35)]",
        "animate-[fade-slide-up_200ms_ease_both]",
        (isDeleting) && "opacity-60 pointer-events-none",
        selectionMode && selected && "ring-2 ring-accent",
        selectionMode && "cursor-pointer",
      )}
      onClick={selectionMode ? handleRowClick : undefined}
      role={selectionMode ? "checkbox" : undefined}
      aria-checked={selectionMode ? selected : undefined}
      aria-label={selectionMode ? t(selected ? "library.deselectBook" : "library.selectBook", { title: book.title }) : undefined}
      tabIndex={selectionMode ? 0 : undefined}
      onKeyDown={
        selectionMode
          ? (e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                onToggle?.(book.id);
              }
            }
          : undefined
      }
    >
      {/* Selection checkbox indicator */}
      {selectionMode && (
        <div
          className={cn(
            "absolute top-2 left-2 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-150",
            selected
              ? "bg-accent border-accent text-white"
              : "bg-black/40 border-white/40 text-transparent",
          )}
          aria-hidden="true"
        >
          <span className="material-symbols-outlined text-[12px]">check</span>
        </div>
      )}

      {/* Cover */}
      <div
        className="shrink-0"
        onClick={(e) => selectionMode && e.stopPropagation()}
      >
        <Link
          href={`/books/${book.id}`}
          className={cn(
            "block focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-[var(--radius-sm)]",
            selectionMode && "pointer-events-none",
          )}
          tabIndex={selectionMode ? -1 : 0}
          aria-label={t("book.openDetail") + ": " + book.title}
        >
          <BookCover
            coverUrl={book.coverUrl}
            title={book.title}
            tone="cool"
            className="w-16 h-24 sm:w-[72px] sm:h-[108px]"
            sizes="(max-width: 640px) 64px, 72px"
          />
        </Link>
      </div>

      {/* Main info — grows to fill available space */}
      <div
        className="flex flex-col gap-1.5 flex-1 min-w-0"
        onClick={(e) => selectionMode && e.stopPropagation()}
      >
        {/* Title */}
        <Link
          href={`/books/${book.id}`}
          className={cn(
            "text-base font-bold text-text leading-tight line-clamp-2",
            "hover:text-accent-strong transition-colors duration-150",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-sm",
            selectionMode && "pointer-events-none",
          )}
          tabIndex={selectionMode ? -1 : 0}
        >
          {book.title}
        </Link>

        {/* Author */}
        <p className="text-sm text-muted truncate">{authorLine}</p>

        {/* Status chips */}
        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
          <Badge status={status} />
          <OwnershipBadge status={book.ownershipStatus} />
        </div>

        {/* Rating + notes */}
        <div className="flex flex-wrap items-center gap-2 mt-0.5">
          {book.rating !== null && (
            <span
              className="text-xs text-gold tabular-nums"
              aria-label={t("book.ratingAriaLabel", { rating: book.rating })}
            >
              {"★".repeat(book.rating)}{"☆".repeat(5 - book.rating)}
            </span>
          )}
          {book.notes && (
            <p className="text-xs text-muted/60 line-clamp-1 min-w-0 flex-1">
              {book.notes}
            </p>
          )}
        </div>
      </div>

      {/* Right controls — stop propagation from selection */}
      <div
        className="flex flex-col gap-2 shrink-0 items-end justify-start"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Status dropdown */}
        <div className="relative">
          <select
            value={status}
            disabled={isStatusLoading}
            onChange={(e) => void handleStatusChange(e.target.value as BookStatus)}
            aria-label={t("book.statusLabel")}
            className={cn(
              "appearance-none cursor-pointer rounded-full border border-line bg-white/6 px-3 py-1.5 text-xs font-bold text-muted",
              "focus:border-accent focus:outline-none focus:text-text",
              "hover:border-white/25 hover:text-text",
              "transition-colors duration-150 pr-6",
              isStatusLoading && "opacity-60 cursor-wait",
            )}
          >
            {BOOK_STATUS_VALUES.map((s) => (
              <option key={s} value={s} className="bg-bg text-text">
                {t(`book.status.${s}`)}
              </option>
            ))}
          </select>
          <span
            className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted text-[0.6rem]"
            aria-hidden="true"
          >
            ▾
          </span>
        </div>

        {/* More button / delete controls */}
        {showDeleteConfirm ? (
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleDelete}
              aria-label={t("book.confirmRemove")}
              className={cn(
                "rounded-full border border-danger/40 bg-danger/10 px-2.5 py-1 text-xs font-bold text-danger",
                "hover:bg-danger/20 transition-colors duration-150",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
                isDeleting && "opacity-60 cursor-wait",
              )}
            >
              {isDeleting ? "…" : t("common.confirm")}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              aria-label={t("common.cancel")}
              className="rounded-full border border-line bg-white/6 px-2.5 py-1 text-xs font-bold text-muted hover:text-text transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              {t("common.cancel")}
            </button>
          </div>
        ) : showMoreMenu ? (
          <div className="flex flex-col gap-1 p-1 rounded-xl border border-line bg-surface/95 backdrop-blur-xl shadow-xl">
            <button
              type="button"
              onClick={() => {
                setShowDeleteConfirm(true);
                setShowMoreMenu(false);
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-danger/80 hover:text-danger hover:bg-danger/8 rounded-lg transition-colors duration-150 whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[14px]">delete</span>
              {t("common.delete")}
            </button>
            <button
              type="button"
              onClick={() => setShowMoreMenu(false)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-muted hover:text-text hover:bg-white/5 rounded-lg transition-colors duration-150 whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
              {t("common.cancel")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowMoreMenu(true)}
            aria-label={t("common.moreOptions")}
            className={cn(
              "w-7 h-7 flex items-center justify-center rounded-full",
              "border border-transparent bg-transparent text-muted/50",
              "hover:border-line hover:text-text hover:bg-white/6",
              "transition-all duration-150",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
            )}
          >
            <span className="material-symbols-outlined text-[18px]">more_horiz</span>
          </button>
        )}
      </div>
    </article>
  );
}
