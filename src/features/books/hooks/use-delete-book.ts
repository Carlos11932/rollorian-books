"use client";

import { useState, useCallback } from "react";
import { deleteBook } from "@/features/books/services/books-api";

export type DeleteState = "idle" | "confirming" | "deleting" | "error";

interface UseDeleteBookReturn {
  deleteState: DeleteState;
  error: string | null;
  requestDelete: () => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
}

/**
 * Encapsulates the delete + confirmation state machine.
 *
 * State transitions: idle -> confirming -> deleting -> (caller navigates on success)
 *                    confirming -> idle (cancel)
 *                    deleting -> error (failure)
 *
 * Used by: BookDetailClient, LibraryBookCard
 */
export function useDeleteBook(bookId: string): UseDeleteBookReturn {
  const [deleteState, setDeleteState] = useState<DeleteState>("idle");
  const [error, setError] = useState<string | null>(null);

  const requestDelete = useCallback(() => {
    setDeleteState("confirming");
    setError(null);
  }, []);

  const confirmDelete = useCallback(async (): Promise<void> => {
    setDeleteState("deleting");
    setError(null);

    try {
      await deleteBook(bookId);
      // Caller is responsible for navigation after successful delete
      // (e.g., router.push("/library") or router.refresh())
    } catch (err) {
      setDeleteState("error");
      setError(
        err instanceof Error ? err.message : "Failed to delete book",
      );
    }
  }, [bookId]);

  const cancelDelete = useCallback(() => {
    setDeleteState("idle");
    setError(null);
  }, []);

  return { deleteState, error, requestDelete, confirmDelete, cancelDelete };
}
