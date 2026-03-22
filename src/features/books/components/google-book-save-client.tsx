"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/features/shared/components/button";
import { createBook } from "@/features/books/services/books-api";
import type { CreateBookPayload } from "@/features/books/types";

interface GoogleBookSaveClientProps {
  /** The book data to POST when saving to the library. */
  payload: Omit<CreateBookPayload, "status">;
}

export function GoogleBookSaveClient({ payload }: GoogleBookSaveClientProps) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSave() {
    setState("saving");
    setErrorMessage(null);

    try {
      const created = await createBook({ ...payload, status: "WISHLIST", genres: payload.genres ?? [] });
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
          Not in your library
        </p>
        <h2
          className="text-2xl font-bold text-text"
          style={{ fontFamily: "var(--font-headline)" }}
        >
          Want to track this book?
        </h2>
        <p className="text-sm text-muted leading-relaxed">
          Save it to your library to update its reading status, add notes, and rate it.
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
        {state === "saved" ? "Saved — redirecting..." : state === "saving" ? "Saving..." : "Save to library"}
      </Button>
    </section>
  );
}
