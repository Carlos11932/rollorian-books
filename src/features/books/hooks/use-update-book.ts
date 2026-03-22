"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { updateBook } from "@/features/books/services/books-api";
import type { UpdateBookPayload } from "@/features/books/types";

type SaveState = "idle" | "saving" | "saved" | "error";

interface UseUpdateBookReturn {
  saveState: SaveState;
  error: string | null;
  update: (id: string, data: UpdateBookPayload) => Promise<void>;
  reset: () => void;
}

/**
 * Encapsulates PATCH updates for status, rating, and notes.
 *
 * State transitions: idle -> saving -> saved -> idle (auto-reset after 2s)
 *                    idle -> saving -> error
 *
 * The auto-reset preserves the current book-detail behavior where the
 * "Saved" label reverts to "Save changes" after a brief delay.
 *
 * Used by: BookDetailClient, LibraryBookCard
 */
export function useUpdateBook(): UseUpdateBookReturn {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup the timer on unmount
  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const update = useCallback(
    async (id: string, data: UpdateBookPayload): Promise<void> => {
      // Clear any pending auto-reset timer
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }

      setSaveState("saving");
      setError(null);

      try {
        await updateBook(id, data);
        setSaveState("saved");

        // Auto-reset to idle after 2s — matches existing book-detail behavior
        resetTimerRef.current = setTimeout(() => {
          setSaveState("idle");
          resetTimerRef.current = null;
        }, 2000);
      } catch (err) {
        setSaveState("error");
        setError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred",
        );
      }
    },
    [],
  );

  const reset = useCallback(() => {
    if (resetTimerRef.current !== null) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    setSaveState("idle");
    setError(null);
  }, []);

  return { saveState, error, update, reset };
}
