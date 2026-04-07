"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { type BookStatus } from "@/lib/types/book";
import { cn } from "@/lib/cn";
import { Badge } from "@/features/shared/components/badge";
import { BookCover } from "../book-cover";
import { AddToListDialog } from "@/features/lists/components/add-to-list-dialog";
import type { LibraryEntryView } from "../../types";
import type { BaseBookCardProps } from "./base-book-card";

interface SearchBookCardProps extends BaseBookCardProps {
  savedStatus?: BookStatus | null;
  onSave?: (book: LibraryEntryView) => Promise<void>;
}

export function SearchBookCard({
  book,
  index = 0,
  savedStatus,
  onSave,
}: SearchBookCardProps) {
  const t = useTranslations("common");
  const tLists = useTranslations("lists");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showListDialog, setShowListDialog] = useState(false);

  const authorLine = book.authors.length > 0 ? book.authors.join(", ") : t("unknownAuthor");
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
    <>
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

          {/* Status badge + add-to-list if already in library */}
          {isAlreadySaved && savedStatus != null && (
            <div className="flex items-center gap-2">
              <Badge status={savedStatus} className="text-[10px] px-2 py-0.5" />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowListDialog(true);
                }}
                className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-white/10 border border-line text-muted hover:text-primary hover:border-primary/30 transition-colors"
                aria-label={tLists("addToList")}
              >
                <span className="material-symbols-outlined text-[14px]">playlist_add</span>
              </button>
            </div>
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
              {saveState === "saving"
                ? t("saving")
                : saveState === "saved"
                  ? t("saved")
                  : saveState === "error"
                    ? t("error")
                    : t("save")}
            </button>
          )}
        </div>
      </Link>

      {isAlreadySaved && (
        <AddToListDialog
          bookId={book.id}
          open={showListDialog}
          onClose={() => setShowListDialog(false)}
        />
      )}
    </>
  );
}
