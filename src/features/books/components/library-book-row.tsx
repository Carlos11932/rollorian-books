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
import {
  hasCompatDegradedField,
  LIBRARY_COMPAT_DEGRADED_FIELD,
  type LibraryEntryView,
} from "../types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LibraryBookRowProps {
  book: LibraryEntryView;
  readOnly?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  onToggle?: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LibraryBookRow({
  book,
  readOnly = false,
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
  const ownershipSynthesized = hasCompatDegradedField(
    book,
    LIBRARY_COMPAT_DEGRADED_FIELD.OWNERSHIP_STATUS,
  );

  const publishYear = book.publishedDate ? book.publishedDate.slice(0, 4) : null;

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

  function handleCardClick() {
    if (selectionMode && onToggle) onToggle(book.id);
  }

  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-[var(--radius-md)] border border-line overflow-hidden",
        "bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.92)]",
        "backdrop-blur-[12px] transition-all duration-200",
        "hover:border-white/20 hover:shadow-[0_8px_32px_rgba(0,0,0,0.40)]",
        "animate-[fade-slide-up_200ms_ease_both]",
        isDeleting && "opacity-60 pointer-events-none",
        selectionMode && selected && "ring-2 ring-accent",
        selectionMode && "cursor-pointer",
      )}
      onClick={selectionMode ? handleCardClick : undefined}
      role={selectionMode ? "checkbox" : undefined}
      aria-checked={selectionMode ? selected : undefined}
      aria-label={
        selectionMode
          ? t(selected ? "library.deselectBook" : "library.selectBook", { title: book.title })
          : undefined
      }
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
      {/* Selection checkbox */}
      {selectionMode && (
        <div
          className={cn(
            "absolute top-2 left-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-150",
            selected
              ? "bg-accent border-accent text-white"
              : "bg-black/50 border-white/40 text-transparent",
          )}
          aria-hidden="true"
        >
          <span className="material-symbols-outlined text-[13px]">check</span>
        </div>
      )}

      {/* Cover — full bleed at the top */}
      <div
        className="relative w-full"
        onClick={(e) => selectionMode && e.stopPropagation()}
      >
        <Link
          href={`/books/${book.id}`}
          className={cn("block", selectionMode && "pointer-events-none")}
          tabIndex={selectionMode ? -1 : 0}
          aria-label={`${t("book.openDetail")}: ${book.title}`}
        >
          <BookCover
            coverUrl={book.coverUrl}
            title={book.title}
            tone="cool"
            className="w-full h-52 rounded-none border-0"
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
        </Link>

        {/* Gradient fade at the bottom of the cover */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[rgba(8,12,20,0.90)] to-transparent pointer-events-none" />

        {/* Badges overlaid on the gradient */}
        <div className="absolute bottom-2 left-3 flex flex-wrap gap-1.5">
          <Badge status={status} />
          {!ownershipSynthesized && <OwnershipBadge status={book.ownershipStatus} />}
          {readOnly && (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
              Read-only
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div
        className="flex flex-col gap-2 px-4 pt-3 pb-2 flex-1"
        onClick={(e) => selectionMode && e.stopPropagation()}
      >
        {/* Title */}
        <Link
          href={`/books/${book.id}`}
          className={cn(
            "text-sm font-bold text-text leading-snug line-clamp-2",
            "hover:text-accent-strong transition-colors duration-150",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-sm",
            selectionMode && "pointer-events-none",
          )}
          tabIndex={selectionMode ? -1 : 0}
        >
          {book.title}
        </Link>

        {/* Author */}
        <p className="text-xs text-muted truncate -mt-1">{authorLine}</p>

        {/* Rating */}
        {book.rating !== null && (
          <span
            className="text-xs text-gold tabular-nums"
            aria-label={t("book.ratingAriaLabel", { rating: book.rating })}
          >
            {"★".repeat(book.rating)}{"☆".repeat(5 - book.rating)}
          </span>
        )}

        {/* Description */}
        {book.description && (
          <p className="text-xs text-muted/70 leading-relaxed line-clamp-4">
            {book.description}
          </p>
        )}

        {/* Notes */}
        {book.notes && (
          <p className="text-xs text-muted/50 italic line-clamp-1">
            &ldquo;{book.notes}&rdquo;
          </p>
        )}

        {/* Meta */}
        {(book.pageCount ?? publishYear) && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted/40 mt-auto pt-1">
            {book.pageCount && <span>{book.pageCount} págs.</span>}
            {book.pageCount && publishYear && <span aria-hidden>·</span>}
            {publishYear && <span>{publishYear}</span>}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div
        className="border-t border-line/40 px-3 py-2.5 flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {readOnly ? (
          <p className="text-[11px] text-amber-300/70 font-bold uppercase tracking-wide">
            Compatibility snapshot
          </p>
        ) : (
          <>
            {/* Status selector */}
            <div className="relative flex-1">
              <select
                value={status}
                disabled={isStatusLoading}
                onChange={(e) => void handleStatusChange(e.target.value as BookStatus)}
                aria-label={t("book.statusLabel")}
                className={cn(
                  "w-full appearance-none cursor-pointer rounded-full border border-line bg-white/6 px-3 py-1.5 text-xs font-bold text-muted",
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

            {/* Delete confirm / more menu */}
            <div className="relative shrink-0">
              {showDeleteConfirm ? (
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDelete}
                    aria-label={t("book.confirmRemove")}
                    className={cn(
                      "rounded-full border border-danger/40 bg-danger/10 px-2.5 py-1 text-xs font-bold text-danger",
                      "hover:bg-danger/20 transition-colors duration-150",
                      isDeleting && "opacity-60 cursor-wait",
                    )}
                  >
                    {isDeleting ? "…" : t("common.confirm")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    aria-label={t("common.cancel")}
                    className="rounded-full border border-line bg-white/6 px-2.5 py-1 text-xs font-bold text-muted hover:text-text transition-colors duration-150"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              ) : showMoreMenu ? (
                <div className="absolute bottom-9 right-0 z-20 flex flex-col gap-1 p-1 rounded-xl border border-line bg-surface/95 backdrop-blur-xl shadow-xl">
                  <button
                    type="button"
                    onClick={() => { setShowDeleteConfirm(true); setShowMoreMenu(false); }}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-danger/80 hover:text-danger hover:bg-danger/8 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                    {t("common.delete")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMoreMenu(false)}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-muted hover:text-text hover:bg-white/5 rounded-lg transition-colors whitespace-nowrap"
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
          </>
        )}
      </div>
    </article>
  );
}
