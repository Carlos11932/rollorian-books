"use client";

import { useState, type ChangeEvent } from "react";
import type { BookStatus } from "@prisma/client";
import { cn } from "@/lib/cn";
import { Badge } from "@/features/shared/components/badge";
import { Button } from "@/features/shared/components/button";
import { BookCover } from "./book-cover";
import { CardOverlay } from "./card-overlay";
import type { SerializableBook } from "../types";

const BOOK_STATUS_OPTIONS: BookStatus[] = [
  "WISHLIST",
  "TO_READ",
  "READING",
  "READ",
];

const STATUS_LABEL: Record<BookStatus, string> = {
  READING: "Reading",
  READ: "Read",
  TO_READ: "To Read",
  WISHLIST: "Wishlist",
};

// --- Discriminated union for variant-specific props ---

interface BrowseVariantProps {
  variant: "browse";
  onOpen?: (id: string) => void;
}

interface SearchVariantProps {
  variant: "search";
  onSave?: (book: SerializableBook) => Promise<void>;
}

interface LibraryVariantProps {
  variant: "library";
  onOpen?: (id: string) => void;
  onStatusChange?: (id: string, status: BookStatus) => Promise<void>;
}

type VariantProps = BrowseVariantProps | SearchVariantProps | LibraryVariantProps;

interface BaseBookCardProps {
  book: SerializableBook;
  index?: number;
}

type BookCardProps = BaseBookCardProps & VariantProps;

// --- Browse Card ---

function BrowseCard({
  book,
  index = 0,
  onOpen,
}: BaseBookCardProps & BrowseVariantProps) {
  const authorLine = book.authors.length > 0 ? book.authors.join(", ") : "Unknown author";

  function handleOpen() {
    onOpen?.(book.id);
  }

  return (
    <article
      className={cn(
        "group relative rounded-[var(--radius-md)] border border-line bg-surface overflow-hidden",
        "transition-all duration-250 ease-out cursor-pointer",
        "hover:scale-105 hover:z-10 hover:shadow-lg hover:border-white/28",
      )}
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
      onClick={handleOpen}
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
          style={{ fontFamily: "var(--font-display)" }}
        >
          {book.title}
        </h3>
        <p className="text-[0.7rem] text-muted truncate">{authorLine}</p>
      </div>

      <CardOverlay
        bookId={book.id}
        title={book.title}
        authors={book.authors}
      />
    </article>
  );
}

// --- Search Card ---

function SearchCard({
  book,
  index = 0,
  onSave,
}: BaseBookCardProps & SearchVariantProps) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const authorLine = book.authors.length > 0 ? book.authors.join(", ") : "Unknown author";

  async function handleSave() {
    if (saveState !== "idle" || !onSave) return;
    setSaveState("saving");
    try {
      await onSave(book);
      setSaveState("saved");
    } catch {
      setSaveState("idle");
    }
  }

  return (
    <article
      className={cn(
        "group relative rounded-[var(--radius-lg)] border border-line bg-surface overflow-hidden",
        "transition-all duration-250 ease-out",
        "hover:scale-105 hover:z-10 hover:shadow-lg hover:border-white/28",
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
      aria-label={`${book.title} by ${authorLine}`}
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
            style={{ fontFamily: "var(--font-display)" }}
          >
            {book.title}
          </h3>
          <p className="text-xs text-muted truncate">{authorLine}</p>
        </div>

        <Button
          variant={saveState === "saved" ? "secondary" : "primary"}
          size="sm"
          loading={saveState === "saving"}
          disabled={saveState === "saved"}
          onClick={handleSave}
          className="w-full text-xs"
        >
          {saveState === "saved" ? "Saved" : "Save to library"}
        </Button>
      </div>

      <CardOverlay
        bookId={book.id}
        title={book.title}
        authors={book.authors}
      />
    </article>
  );
}

// --- Library Card ---

function LibraryCard({
  book,
  index = 0,
  onOpen,
  onStatusChange,
}: BaseBookCardProps & LibraryVariantProps) {
  const authorLine = book.authors.length > 0 ? book.authors.join(", ") : "Unknown author";

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
            style={{ fontFamily: "var(--font-display)" }}
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
              Status
            </span>
            <select
              defaultValue={book.status}
              onChange={handleStatusChange}
              className="rounded-[var(--radius-sm)] border border-line bg-surface-soft text-text text-xs px-2 py-1.5 focus:outline-none focus:border-accent/50"
            >
              {BOOK_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
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
            Open detail
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
