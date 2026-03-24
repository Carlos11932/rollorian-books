"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from 'next-intl';
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

export function GoogleBookSaveClient({ payload }: GoogleBookSaveClientProps) {
  const router = useRouter();
  const t = useTranslations('book');
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSave() {
    setState("saving");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, status: "WISHLIST" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to save book");
      }

      const created = (await res.json()) as { id: string };
      setState("saved");

      // Redirect to the real library detail page
      router.push(`/books/${created.id}`);
    } catch (err) {
      setState("error");
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred");
    }
  }

  return (
    <section
      className="rounded-[var(--radius-xl)] border border-accent/30 bg-gradient-to-b from-[rgba(19,27,41,0.88)] to-[rgba(8,12,20,0.88)] p-6"
      style={{ backdropFilter: "blur(16px)" }}
      aria-label="Save to library"
    >
      <div className="grid gap-1 mb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">
          {t('notInLibrary')}
        </p>
        <h2
          className="text-2xl font-bold text-text"
          style={{ fontFamily: "var(--font-headline)" }}
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

      <Button
        variant="primary"
        size="md"
        loading={state === "saving"}
        disabled={state === "saving" || state === "saved"}
        onClick={handleSave}
      >
        {state === "saved" ? t('savedRedirecting') : state === "saving" ? t('savingChanges') : t('saveToLibrary')}
      </Button>
    </section>
  );
}
