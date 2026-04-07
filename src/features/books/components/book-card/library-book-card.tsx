"use client";

import { useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { type BookStatus, BOOK_STATUS_VALUES } from "@/lib/types/book";
import { cn } from "@/lib/cn";
import { Badge } from "@/features/shared/components/badge";
import { Button } from "@/features/shared/components/button";
import { BookCover } from "../book-cover";
import { AddToListDialog } from "@/features/lists/components/add-to-list-dialog";
import type { LibraryEntryView } from "../../types";
import type { BaseBookCardProps } from "./base-book-card";

interface LibraryBookCardProps extends BaseBookCardProps {
  onOpen?: (id: string) => void;
  onStatusChange?: (id: string, status: BookStatus) => Promise<void>;
}

export function LibraryVariantCard({
  book,
  index = 0,
  onOpen,
  onStatusChange,
}: LibraryBookCardProps) {
  const t = useTranslations();
  const [showListDialog, setShowListDialog] = useState(false);
  const authorLine =
    book.authors.length > 0 ? book.authors.join(", ") : t("common.unknownAuthor");

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
              {t("book.statusLabel")}
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

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpen}
              className="flex-1 text-xs"
            >
              {t("book.openDetail")}
            </Button>
            <button
              type="button"
              onClick={() => setShowListDialog(true)}
              className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-white/10 border border-line text-muted hover:text-primary hover:border-primary/30 transition-colors"
              aria-label={t("lists.addToList")}
            >
              <span className="material-symbols-outlined text-[16px]">playlist_add</span>
            </button>
          </div>
        </div>
      </div>

      <AddToListDialog
        bookId={book.id}
        open={showListDialog}
        onClose={() => setShowListDialog(false)}
      />
    </article>
  );
}

// Re-export LibraryEntryView for convenience
export type { LibraryEntryView };
