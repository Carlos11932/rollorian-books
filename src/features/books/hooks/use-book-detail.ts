"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LibraryEntryView } from "../types";
import type { BookStatus } from "@/lib/types/book";
import { updateBook, deleteBook } from "@/lib/api/books";

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

export interface UseBookDetailReturn {
  // State
  status: BookStatus;
  rating: number | null;
  hoverRating: number | null;
  notes: string;
  saveState: SaveState;
  deleteState: DeleteState;
  errorMessage: string | null;
  // Derived
  displayRating: number | null;
  isSaving: boolean;
  isDeleting: boolean;
  // Handlers
  setStatus: (status: BookStatus) => void;
  setRating: (rating: number | null) => void;
  setHoverRating: (rating: number | null) => void;
  setNotes: (notes: string) => void;
  setDeleteState: (state: DeleteState) => void;
  handleSave: () => Promise<void>;
  handleDelete: () => Promise<void>;
}

export function useBookDetail(book: LibraryEntryView): UseBookDetailReturn {
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

  return {
    status,
    rating,
    hoverRating,
    notes,
    saveState,
    deleteState,
    errorMessage,
    displayRating,
    isSaving,
    isDeleting,
    setStatus,
    setRating,
    setHoverRating,
    setNotes,
    setDeleteState,
    handleSave,
    handleDelete,
  };
}

export { SAVE_STATE, DELETE_STATE };
