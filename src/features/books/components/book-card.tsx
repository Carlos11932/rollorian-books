"use client";

import { useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useTranslations } from 'next-intl';
import { type BookStatus, BOOK_STATUS_VALUES } from "@/lib/types/book";
import { cn } from "@/lib/cn";
import { Badge } from "@/features/shared/components/badge";
import { Button } from "@/features/shared/components/button";
import { BookCover } from "./book-cover";
import { CardOverlay } from "./card-overlay";
import type { LibraryEntryView } from "../types";

// --- Discriminated union for variant-specific props ---

interface BrowseVariantProps {
  variant: "browse";
}

interface SearchVariantProps {
  variant: "search";
  savedStatus?: BookStatus | null;
  onSave?: (book: LibraryEntryView) => Promise<void>;
}

interface LibraryVariantProps {
  variant: "library";
  onOpen?: (id: string) => void;
  onStatusChange?: (id: string, status: BookStatus) => Promise<void>;
}

type VariantProps = BrowseVariantProps | SearchVariantProps | LibraryVariantProps;

interface BaseBookCardProps {
  book: LibraryEntryView;
  index?: number;
}

type BookCardProps = BaseBookCardProps & VariantProps;

// --- Browse Card ---

function BrowseCard({
  book,
  index = 0,
}: BaseBookCardProps & BrowseVariantProps) {
  const t = useTranslations('common');
  const authorLine = book.authors.length > 0 ? book.authors.join(", ") : t('unknownAuthor');

  return (
    <Link
      href={`/books/${book.id}`}
      className="group relative block rounded-[var(--radius-md)] border border-line bg-surface overflow-hidden transition-all duration-250 ease-out hover:scale-105 hover:z-10 hover:shadow-lg hover:border-white/28 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      style={{
        animationName: "fade-slide-up",
        animationDuration: "350ms",
        animationTimingFunction: "ease",
        animationFillMode: "both",
        animationDelay: `${index * 60}ms`,
        width: "118px",
        minWidth: "118px",
        scrollSnapAlign: "start",
      }}
      aria-label={`${book.title} by ${authorLine}`}
    >
      <BookCover
        coverUrl={book.coverUrl}
        title={book.title}
        tone="cool"
        className="w-full h-[176px] min-h-[176px]"
        sizes="118px"
      />

      <div className="p-2 grid gap-1">
        <Badge status={book.status} className="text-[10px] px-2 py-0.5" />
        <h3
          className="text-[0.78rem] font-bold text-text leading-tight line-clamp-2"
          style={{ fontFamily: "var(--font-headline)" }}
        >
          {book.title}
        </h3>
        <p className="text-[0.7rem] text-muted truncate">{authorLine}</p>
      </div>

      <CardOverlay
        bookId={book.id}
        title={book.title}
        authors={book.authors}
        showLink={false}
      />
    </Link>
  );
}

// --- Search Card ---

function SearchCard({
  book,
  index = 0,
  savedStatus,
  onSave,
}: BaseBookCardProps & SearchVariantProps) {
  const t = useTranslations('common');
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const authorLine = book.authors.length > 0 ? book.authors.join(", ") : t('unknownAuthor');

  const isAlreadySaved = savedStatus != null;
  const isSaved = isAlreadySaved || saveState === "saved";

  async function handleSave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (saveState !== "idle" || !onSave || isAlreadySaved) return;
    setSaveState("saving");
    try {
      await onSave(book);
      setSaveState("saved");
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2000);
    }
  }

  return (
    <Link
      href={`/books/${book.id}`}
      className={cn(
        "group relative block rounded-[var(--radius-lg)] border border-line bg-surface overflow-hidden",
        "transition-all duration-250 ease-out",
        "hover:scale-105 hover:z-10 hover:shadow-lg hover:border-white/28",
        "focus:outline-none focus:ring-2 focus:ring-primary/50",
      )}
      style={{
        animationName: "fade-slide-up",
        animationDuration: "350ms",
        animationTimingFunction: "ease",
        animationFillMode: "both",
        animationDelay: `${index * 60}ms`,
        width: "160px",
        minWidth: "160px",
      }}
      aria-label={`${book.title} by ${authorLine}${isSaved ? ` — ${savedStatus ?? "Saved"}` : ""}`}
    >
      <BookCover
        coverUrl={book.coverUrl}
        title={book.title}
        tone="cool"
        className="w-full h-[220px] min-h-[220px]"
        sizes="160px"
      />

      <div className="p-3 grid gap-2">
        <div className="grid gap-0.5">
          <h3
            className="text-sm font-bold text-text leading-tight line-clamp-2"
            style={{ fontFamily: "var(--font-headline)" }}
          >
            {book.title}
          </h3>
          <p className="text-xs text-muted truncate">{authorLine}</p>
        </div>

        {/* Status badge if already in library */}
        {isAlreadySaved && savedStatus != null && (
          <Badge status={savedStatus} className="text-[10px] px-2 py-0.5 self-start" />
        )}

        {/* Save button — only visible when not yet saved */}
        {!isAlreadySaved && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saveState !== "idle"}
            className={cn(
              "w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold",
              "border transition-colors duration-150",
              "focus:outline-none focus:ring-2 focus:ring-primary/50",
              saveState === "saved"
                ? "bg-white/10 text-white/50 border-white/10 cursor-default"
                : saveState === "error"
                  ? "bg-error/15 text-error border-error/30"
                  : "bg-primary/15 text-primary border-primary/30 hover:bg-primary/25",
              saveState === "saving" && "opacity-60 cursor-not-allowed",
            )}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
              {saveState === "saved" ? "bookmark" : saveState === "error" ? "error" : "bookmark_add"}
            </span>
            {saveState === "saving" ? t('saving') : saveState === "saved" ? t('saved') : saveState === "error" ? t('error') : t('save')}
          </button>
        )}
      </div>
    </Link>
  );
}

// --- Library Card ---

function LibraryCard({
  book,
  index = 0,
  onOpen,
  onStatusChange,
}: BaseBookCardProps & LibraryVariantProps) {
  const t = useTranslations();
  const authorLine = book.authors.length > 0 ? book.authors.join(", ") : t('common.unknownAuthor');

  async function handleStatusChange(e: ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as BookStatus;
    await onStatusChange?.(book.id, newStatus);
  }

  function handleOpen() {
    onOpen?.(book.id);
  }

  return (
    <article
      className={cn(
        "group relative grid grid-cols-[118px_1fr] gap-3 rounded-[var(--radius-lg)] border border-line bg-surface p-3",
        "transition-all duration-250 ease-out",
        "hover:scale-[1.02] hover:z-10 hover:shadow-lg hover:border-white/28",
      )}
      style={{
        animationName: "fade-slide-up",
        animationDuration: "350ms",
        animationTimingFunction: "ease",
        animationFillMode: "both",
        animationDelay: `${index * 60}ms`,
      }}
    >
      <BookCover
        coverUrl={book.coverUrl}
        title={book.title}
        tone="warm"
        className="w-[118px] h-[176px] min-h-[176px]"
        sizes="118px"
      />

      <div className="grid gap-2 content-start min-w-0">
        <div className="grid gap-0.5">
          <Badge status={book.status} />
          <h3
            className="text-base font-bold text-text leading-tight line-clamp-2"
            style={{ fontFamily: "var(--font-headline)" }}
          >
            {book.title}
          </h3>
          <p className="text-xs text-muted truncate">{authorLine}</p>
          {book.notes && (
            <p className="text-xs text-muted line-clamp-2 mt-1">{book.notes}</p>
          )}
        </div>

        <div className="grid gap-2 mt-auto">
          <label className="grid gap-1">
            <span className="text-xs text-muted font-medium uppercase tracking-wide">
              {t('book.statusLabel')}
            </span>
            <select
              defaultValue={book.status}
              onChange={handleStatusChange}
              className="rounded-[var(--radius-sm)] border border-line bg-surface-soft text-text text-xs px-2 py-1.5 focus:outline-none focus:border-accent/50"
            >
              {BOOK_STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {t(`book.status.${s}`)}
                </option>
              ))}
            </select>
          </label>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleOpen}
            className="w-full text-xs"
          >
            {t('book.openDetail')}
          </Button>
        </div>
      </div>
    </article>
  );
}

// --- Polymorphic BookCard entry point ---

export function BookCard(props: BookCardProps) {
  if (props.variant === "browse") {
    return <BrowseCard {...props} />;
  }
  if (props.variant === "search") {
    return <SearchCard {...props} />;
  }
  return <LibraryCard {...props} />;
}
