"use client";

import { useState, useCallback } from "react";
import type { NormalizedBook } from "@/lib/google-books/types";
import { toSavePayload } from "@/features/books/services/book-serializer";
import { createBook } from "@/features/books/services/books-api";

type SaveState = "idle" | "saving" | "saved" | "error";

interface UseSaveBookReturn {
  saveState: SaveState;
  error: string | null;
  save: (book: NormalizedBook) => Promise<void>;
  reset: () => void;
}

/**
 * Encapsulates the save-to-library state machine.
 *
 * State transitions: idle -> saving -> saved | error
 *
 * Used by: SearchCard, GoogleBookSaveClient, SearchResultsGrid
 */
export function useSaveBook(): UseSaveBookReturn {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(async (book: NormalizedBook): Promise<void> => {
    setSaveState("saving");
    setError(null);

    try {
      const payload = toSavePayload(book);
      await createBook(payload);
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    }
  }, []);

  const reset = useCallback(() => {
    setSaveState("idle");
    setError(null);
  }, []);

  return { saveState, error, save, reset };
}
