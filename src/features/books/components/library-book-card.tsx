"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookCover } from "./book-cover";
import { Badge } from "@/features/shared/components/badge";
import { useUpdateBook } from "@/features/books/hooks/use-update-book";
import { useDeleteBook } from "@/features/books/hooks/use-delete-book";
import type { BookStatus } from "@/lib/types/book";
import { BOOK_STATUS_OPTIONS } from "@/lib/types/book";
import { cn } from "@/lib/cn";

interface LibraryBook {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  status: BookStatus;
  rating: number | null;
  notes: string | null;
  publisher: string | null;
  publishedDate: string | null;
}

interface LibraryBookCardProps {
  book: LibraryBook;
}

export function LibraryBookCard({ book }: LibraryBookCardProps) {
  const router = useRouter();
  const [status, setStatus] = useState<BookStatus>(book.status);

  const { update, saveState } = useUpdateBook();
  const {
    deleteState,
    requestDelete,
    confirmDelete,
    cancelDelete,
  } = useDeleteBook(book.id);

  const isStatusLoading = saveState === "saving";
  const isDeleting = deleteState === "deleting";

  const authorLine =
    book.authors.length > 0 ? book.authors.join(", ") : "Unknown author";

  async function handleStatusChange(newStatus: BookStatus) {
    if (newStatus === status) return;
    setStatus(newStatus);

    try {
      await update(book.id, { status: newStatus });
      router.refresh();
    } catch {
      setStatus(book.status);
    }
  }

  async function handleDelete() {
    await confirmDelete();
    router.refresh();
  }

  return (
    <article
      className={cn(
        "group relative flex gap-4 rounded-[var(--radius-md)] border border-line p-4",
        "bg-gradient-to-br from-[rgba(19,27,41,0.82)] to-[rgba(8,12,20,0.82)]",
        "backdrop-blur-[12px] transition-all duration-200",
        "hover:border-white/18 hover:from-[rgba(19,27,41,0.92)] hover:to-[rgba(8,12,20,0.92)]",
        "hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
        (isDeleting) && "opacity-60 pointer-events-none",
      )}
      style={{ backdropFilter: "blur(12px)" }}
    >
      {/* Cover — click navigates to detail */}
      <Link
        href={`/books/${book.id}`}
        className="shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-[var(--radius-sm)]"
        tabIndex={0}
        aria-label={`View details for ${book.title}`}
      >
        <BookCover
          coverUrl={book.coverUrl}
          title={book.title}
          tone="cool"
          className="w-[72px] h-[108px]"
          sizes="72px"
        />
      </Link>

      {/* Main content */}
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {/* Title + author */}
        <div className="min-w-0">
          <Link
            href={`/books/${book.id}`}
            className="block truncate text-base font-bold text-text hover:text-accent-strong transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-sm"
              style={{ fontFamily: "var(--font-headline)" }}
          >
            {book.title}
          </Link>
          <p className="truncate text-sm text-muted">{authorLine}</p>
        </div>

        {/* Status badge + inline rating */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge status={status} />
          {book.rating !== null && (
            <span className="text-xs text-gold tabular-nums" aria-label={`Rating: ${book.rating} out of 5`}>
              {"★".repeat(book.rating)}{"☆".repeat(5 - book.rating)}
            </span>
          )}
        </div>

        {/* Notes preview */}
        {book.notes && (
          <p className="text-xs text-muted line-clamp-2 leading-relaxed">
            {book.notes}
          </p>
        )}
      </div>

      {/* Controls — status select + delete */}
      <div
        className="flex flex-col gap-2 shrink-0 items-end"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Status dropdown */}
        <div className="relative">
          <select
            value={status}
            disabled={isStatusLoading}
            onChange={(e) => handleStatusChange(e.target.value as BookStatus)}
            aria-label="Change reading status"
            className={cn(
              "appearance-none cursor-pointer rounded-full border border-line bg-white/6 px-3 py-1.5 text-xs font-bold text-muted",
              "focus:border-accent focus:outline-none focus:text-text",
              "hover:border-white/25 hover:text-text",
              "transition-colors duration-150 pr-6",
              isStatusLoading && "opacity-60 cursor-wait",
            )}
          >
            {BOOK_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-bg text-text">
                {opt.label}
              </option>
            ))}
          </select>
          {/* Chevron icon */}
          <span
            className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted text-[0.6rem]"
            aria-hidden="true"
          >
            ▾
          </span>
        </div>

        {/* Delete controls */}
        {deleteState === "confirming" ? (
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleDelete}
              aria-label="Confirm delete"
              className={cn(
                "rounded-full border border-danger/40 bg-danger/10 px-2.5 py-1 text-xs font-bold text-danger",
                "hover:bg-danger/20 transition-colors duration-150",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
                isDeleting && "opacity-60 cursor-wait",
              )}
            >
              {isDeleting ? "…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={cancelDelete}
              aria-label="Cancel delete"
              className="rounded-full border border-line bg-white/6 px-2.5 py-1 text-xs font-bold text-muted hover:text-text transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={requestDelete}
            aria-label={`Delete ${book.title}`}
            className="rounded-full border border-transparent bg-transparent px-2.5 py-1 text-xs font-bold text-muted/50 hover:border-danger/30 hover:text-danger hover:bg-danger/8 transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Delete
          </button>
        )}
      </div>
    </article>
  );
}

export type { LibraryBook };
