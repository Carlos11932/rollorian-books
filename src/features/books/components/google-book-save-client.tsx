"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from 'next-intl';
import { cn } from "@/lib/cn";
import { Button } from "@/features/shared/components/button";

interface GoogleBookSaveClientProps {
  /** The book data to POST when saving to the library. */
  payload: {
    title: string;
    authors: string[];
    subtitle?: string;
    description?: string;
    coverUrl?: string;
    publisher?: string;
    publishedDate?: string;
    pageCount?: number;
    isbn10?: string;
    isbn13?: string;
    genres: string[];
  };
}

type SaveVariant = "default" | "haveIt" | "alreadyRead";

export function GoogleBookSaveClient({ payload }: GoogleBookSaveClientProps) {
  const router = useRouter();
  const t = useTranslations('book');
  const tCommon = useTranslations('common');
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);

  async function handleSave(variant: SaveVariant = "default") {
    setState("saving");
    setErrorMessage(null);

    // Only send ownershipStatus when the user explicitly chose a stronger value.
    const statusMap: Record<SaveVariant, { status: string; ownershipStatus?: string }> = {
      default: { status: "WISHLIST" },
      haveIt: { status: "WISHLIST", ownershipStatus: "OWNED" },
      alreadyRead: { status: "READ" },
    };
    const { status, ownershipStatus } = statusMap[variant];

    try {
      const res = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          status,
          ...(ownershipStatus ? { ownershipStatus } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? tCommon('error'));
      }

      const created = (await res.json()) as { id: string; book: { id: string } };
      setState("saved");

      // Redirect to the real library detail page — use Book.id, not UserBook.id
      router.push(`/books/${created.book?.id ?? created.id}`);
    } catch (err) {
      setState("error");
      setErrorMessage(err instanceof Error ? err.message : tCommon('error'));
    }
  }

  const isBusy = state === "saving" || state === "saved";

  return (
    <section
      className="card-glass backdrop-blur-xl border-accent/30 p-6"
      aria-label={t('saveToLibrary')}
    >
      <div className="grid gap-1 mb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">
          {t('notInLibrary')}
        </p>
        <h2
          className="text-2xl font-bold text-text"
        >
          {t('trackQuestion')}
        </h2>
        <p className="text-sm text-muted leading-relaxed">
          {t('trackDescription')}
        </p>
      </div>

      {errorMessage && (
        <div role="alert" className="text-sm text-danger mb-3">
          {errorMessage}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {/* Primary: quick save (WISHLIST, ownership unspecified) */}
        <Button
          variant="primary"
          size="md"
          loading={state === "saving"}
          disabled={isBusy}
          onClick={() => handleSave("default")}
        >
          {state === "saved" ? t('savedRedirecting') : state === "saving" ? t('savingChanges') : t('saveToLibrary')}
        </Button>

        {/* Toggle to expand quick options */}
        {!isBusy && (
          <button
            type="button"
            onClick={() => setShowOptions((v) => !v)}
            aria-expanded={showOptions}
            className={cn(
              "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border transition-all duration-150",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
              showOptions
                ? "bg-white/12 text-on-surface border-white/20"
                : "bg-white/4 text-muted border-white/8 hover:bg-white/8 hover:text-on-surface",
            )}
          >
            <span className="material-symbols-outlined text-[14px]">
              {showOptions ? "expand_less" : "expand_more"}
            </span>
            {t('saveQuickOptions.wantToRead')}
          </button>
        )}
      </div>

      {/* Expandable quick-save options */}
      {showOptions && !isBusy && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/8">
          {/* "I have it" — WISHLIST + OWNED */}
          <button
            type="button"
            onClick={() => handleSave("haveIt")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all duration-150",
              "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
              "hover:bg-emerald-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
            )}
          >
            <span className="material-symbols-outlined text-[14px]">inventory_2</span>
            {t('saveQuickOptions.haveIt')}
          </button>

          {/* "Already read" — READ, ownership unspecified */}
          <button
            type="button"
            onClick={() => handleSave("alreadyRead")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all duration-150",
              "bg-white/8 text-on-surface/70 border-white/12",
              "hover:bg-white/12 hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
            )}
          >
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            {t('saveQuickOptions.alreadyRead')}
          </button>
        </div>
      )}
    </section>
  );
}
