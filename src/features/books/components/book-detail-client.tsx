"use client";

import { useTranslations } from 'next-intl';
import { cn } from "@/lib/cn";
import { Button } from "@/features/shared/components/button";
import type { LibraryEntryView } from "../types";
import { BOOK_STATUS_VALUES, OWNERSHIP_STATUS_VALUES } from "@/lib/types/book";
import { useBookDetail, SAVE_STATE, DELETE_STATE } from "../hooks/use-book-detail";

interface BookDetailClientProps {
  book: LibraryEntryView;
}

export function BookDetailClient({ book }: BookDetailClientProps) {
  const t = useTranslations();
  const {
    status,
    ownershipStatus,
    rating,
    notes,
    saveState,
    deleteState,
    errorMessage,
    displayRating,
    isSaving,
    isDeleting,
    setStatus,
    setOwnershipStatus,
    setRating,
    setHoverRating,
    setNotes,
    setDeleteState,
    handleSave,
    handleDelete,
  } = useBookDetail(book);

  return (
    <section
      className="card-glass backdrop-blur-xl p-6"
      aria-label={t('book.manageBook')}
    >
      <div className="grid gap-1 mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-muted">{t('book.manage')}</p>
        <h2
          className="text-2xl font-bold text-text"
        >
          {t('book.updateState')}
        </h2>
      </div>

      <div className="grid gap-5 max-w-lg">
        {/* Reading Status */}
        <label className="grid gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-muted">{t('book.statusLabel')}</span>
          <select
            value={status}
            disabled={isSaving || isDeleting}
            onChange={(e) => setStatus(e.target.value as Parameters<typeof setStatus>[0])}
            aria-label={t('book.readingStatus')}
            className={cn(
              "rounded-[var(--radius-sm)] border border-line bg-surface-soft text-text text-sm px-3 py-2.5",
              "focus:outline-none focus:border-accent/50",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              "transition-colors duration-150",
            )}
          >
            {BOOK_STATUS_VALUES.map((s) => (
              <option key={s} value={s} className="bg-bg text-text">
                {t(`book.status.${s}`)}
              </option>
            ))}
          </select>
        </label>

        {/* Ownership */}
        <div className="grid gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-muted">{t('book.ownershipLabel')}</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('book.ownershipStatus')}>
            {OWNERSHIP_STATUS_VALUES.map((o) => (
              <button
                key={o}
                type="button"
                disabled={isSaving || isDeleting}
                onClick={() => setOwnershipStatus(o)}
                aria-pressed={ownershipStatus === o}
                className={cn(
                  "inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold border transition-all duration-150",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                  ownershipStatus === o
                    ? o === "OWNED"
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                      : o === "NOT_OWNED"
                        ? "bg-white/12 text-on-surface border-white/20"
                        : "bg-white/8 text-on-surface/50 border-white/10"
                    : "bg-white/4 text-muted border-white/8 hover:bg-white/8 hover:text-on-surface",
                )}
              >
                {o === "OWNED" && ownershipStatus === o && (
                  <span className="material-symbols-outlined text-[12px] mr-1">check_circle</span>
                )}
                {t(`book.ownership.${o}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Star rating */}
        <div className="grid gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-muted">
            {t('book.ratingLabel')}{displayRating !== null ? ` — ${t(`book.rating.${displayRating}`)}` : ""}
          </span>
          <div
            className="flex gap-1"
            role="group"
            aria-label={t('book.bookRating')}
          >
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                disabled={isSaving || isDeleting}
                onClick={() => setRating(rating === star ? null : star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(null)}
                aria-label={`${t('book.rateStar', { star })} — ${t(`book.rating.${star}`)}`}
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
                aria-label={t('book.clearRating')}
                className="ml-2 text-xs text-muted hover:text-text transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-sm disabled:opacity-60 self-center"
              >
                {t('common.clear')}
              </button>
            )}
          </div>
        </div>

        {/* Notes */}
        <label className="grid gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-muted">{t('book.notesLabel')}</span>
          <textarea
            value={notes}
            disabled={isSaving || isDeleting}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('book.notesPlaceholder')}
            rows={4}
            aria-label={t('book.bookNotes')}
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
            {saveState === SAVE_STATE.saved ? t('book.savedChanges') : isSaving ? t('book.savingChanges') : t('book.saveChanges')}
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
                {isDeleting ? t('book.removing') : t('book.confirmRemove')}
              </Button>
              <Button
                variant="ghost"
                size="md"
                disabled={isDeleting}
                onClick={() => setDeleteState(DELETE_STATE.idle)}
              >
                {t('common.cancel')}
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
              {t('book.removeBook')}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
