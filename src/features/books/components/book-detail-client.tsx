"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Button } from "@/features/shared/components/button";
import type { SerializableBook } from "../types";
import { type BookStatus, BOOK_STATUS_OPTIONS } from "@/lib/types/book";
import { updateBook, deleteBook } from "@/lib/api/books";

const RATING_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Great",
  5: "Excellent",
};

interface BookDetailClientProps {
  book: SerializableBook;
}

const SAVE_STATE = {
  idle: "idle",
  saving: "saving",
  saved: "saved",
  error: "error",
} as const;

type SaveState = (typeof SAVE_STATE)[keyof typeof SAVE_STATE];

const DELETE_STATE = {
  idle: "idle",
  confirming: "confirming",
  deleting: "deleting",
} as const;

type DeleteState = (typeof DELETE_STATE)[keyof typeof DELETE_STATE];

export function BookDetailClient({ book }: BookDetailClientProps) {
  const router = useRouter();
  const saveStateResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status, setStatus] = useState<BookStatus>(book.status);
  const [rating, setRating] = useState<number | null>(book.rating ?? null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [notes, setNotes] = useState(book.notes ?? "");
  const [saveState, setSaveState] = useState<SaveState>(SAVE_STATE.idle);
  const [deleteState, setDeleteState] = useState<DeleteState>(DELETE_STATE.idle);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (saveStateResetRef.current !== null) {
        clearTimeout(saveStateResetRef.current);
      }
    };
  }, []);

  async function handleSave() {
    if (saveStateResetRef.current !== null) {
      clearTimeout(saveStateResetRef.current);
      saveStateResetRef.current = null;
    }

    setSaveState(SAVE_STATE.saving);
    setErrorMessage(null);

    try {
      await updateBook(book.id, {
        status,
        rating: rating ?? null,
        notes: notes.trim() || null,
      });

      setSaveState(SAVE_STATE.saved);
      router.refresh();

      // Reset to idle after short delay
      saveStateResetRef.current = setTimeout(() => {
        setSaveState(SAVE_STATE.idle);
        saveStateResetRef.current = null;
      }, 2000);
    } catch (err) {
      setSaveState(SAVE_STATE.error);
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred");
    }
  }

  async function handleDelete() {
    setDeleteState(DELETE_STATE.deleting);

    try {
      await deleteBook(book.id);

      router.push("/library");
    } catch (err) {
      setDeleteState(DELETE_STATE.idle);
      setErrorMessage(err instanceof Error ? err.message : "Failed to delete book");
    }
  }

  const displayRating = hoverRating ?? rating;
  const isSaving = saveState === SAVE_STATE.saving;
  const isDeleting = deleteState === DELETE_STATE.deleting;

  return (
    <section
      className="rounded-[var(--radius-xl)] border border-line bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] p-6"
      style={{ backdropFilter: "blur(16px)" }}
      aria-label="Manage book"
    >
      <div className="grid gap-1 mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-muted">Manage</p>
        <h2
          className="text-2xl font-bold text-text"
          style={{ fontFamily: "var(--font-headline)" }}
        >
          Update reading state
        </h2>
      </div>

      <div className="grid gap-5 max-w-lg">
        {/* Status */}
        <label className="grid gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-muted">Status</span>
          <select
            value={status}
            disabled={isSaving || isDeleting}
            onChange={(e) => setStatus(e.target.value as BookStatus)}
            aria-label="Reading status"
            className={cn(
              "rounded-[var(--radius-sm)] border border-line bg-surface-soft text-text text-sm px-3 py-2.5",
              "focus:outline-none focus:border-accent/50",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              "transition-colors duration-150",
            )}
          >
            {BOOK_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-bg text-text">
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {/* Star rating */}
        <div className="grid gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-muted">
            Rating{displayRating !== null ? ` — ${RATING_LABELS[displayRating]}` : ""}
          </span>
          <div
            className="flex gap-1"
            role="group"
            aria-label="Book rating"
          >
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                disabled={isSaving || isDeleting}
                onClick={() => setRating(rating === star ? null : star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(null)}
                aria-label={`Rate ${star} out of 5 — ${RATING_LABELS[star]}`}
                aria-pressed={rating === star}
                className={cn(
                  "text-2xl transition-all duration-100 cursor-pointer",
                  "hover:scale-110 active:scale-95",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-sm",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                  displayRating !== null && star <= displayRating
                    ? "text-gold"
                    : "text-muted/40",
                )}
              >
                ★
              </button>
            ))}
            {rating !== null && (
              <button
                type="button"
                disabled={isSaving || isDeleting}
                onClick={() => setRating(null)}
                aria-label="Clear rating"
                className="ml-2 text-xs text-muted hover:text-text transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-sm disabled:opacity-60 self-center"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Notes */}
        <label className="grid gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-muted">Notes</span>
          <textarea
            value={notes}
            disabled={isSaving || isDeleting}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Write something useful about this book."
            rows={4}
            aria-label="Book notes"
            className={cn(
              "rounded-[var(--radius-sm)] border border-line bg-surface-soft text-text text-sm px-3 py-2.5",
              "placeholder:text-muted resize-y leading-relaxed",
              "focus:outline-none focus:border-accent/50",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              "transition-colors duration-150",
            )}
          />
        </label>

        {/* Error message */}
        {errorMessage && (
          <div role="alert" className="text-sm text-danger">
            {errorMessage}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-1">
          <Button
            variant="primary"
            size="md"
            loading={isSaving}
            disabled={isSaving || isDeleting}
            onClick={handleSave}
          >
            {saveState === SAVE_STATE.saved ? "Saved" : isSaving ? "Saving..." : "Save changes"}
          </Button>

          {deleteState === DELETE_STATE.confirming ? (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="md"
                loading={isDeleting}
                disabled={isDeleting}
                onClick={handleDelete}
                className="border-danger/40 text-danger hover:bg-danger/10"
              >
                {isDeleting ? "Removing..." : "Confirm remove"}
              </Button>
              <Button
                variant="ghost"
                size="md"
                disabled={isDeleting}
                onClick={() => setDeleteState(DELETE_STATE.idle)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="md"
              disabled={isSaving || isDeleting}
              onClick={() => setDeleteState(DELETE_STATE.confirming)}
              className="text-muted hover:text-danger hover:border-danger/30"
            >
              Remove book
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
