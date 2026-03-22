"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/features/shared/components/button";
import { StarRating } from "@/features/shared/components/star-rating";
import { StatusSelect } from "@/features/books/components/status-select";
import { NotesField } from "@/features/books/components/notes-field";
import { DeleteConfirmation } from "@/features/books/components/delete-confirmation";
import { useUpdateBook } from "@/features/books/hooks/use-update-book";
import { useDeleteBook } from "@/features/books/hooks/use-delete-book";
import type { SerializableBook } from "../types";
import type { BookStatus } from "@/lib/types/book";

interface BookDetailClientProps {
  book: SerializableBook;
}

export function BookDetailClient({ book }: BookDetailClientProps) {
  const router = useRouter();

  const [status, setStatus] = useState<BookStatus>(book.status);
  const [rating, setRating] = useState<number | null>(book.rating ?? null);
  const [notes, setNotes] = useState(book.notes ?? "");

  const { update, saveState, error: updateError } = useUpdateBook();
  const {
    deleteState,
    error: deleteError,
    requestDelete,
    confirmDelete,
    cancelDelete,
  } = useDeleteBook(book.id);

  const errorMessage = updateError ?? deleteError;
  const isSaving = saveState === "saving";
  const isDeleting = deleteState === "deleting";
  const isBusy = isSaving || isDeleting;

  async function handleSave() {
    await update(book.id, {
      status,
      rating: rating ?? null,
      notes: notes.trim() || null,
    });
    router.refresh();
  }

  async function handleDelete() {
    await confirmDelete();
    router.push("/library");
  }

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
        <StatusSelect value={status} disabled={isBusy} onChange={setStatus} />
        <StarRating value={rating} disabled={isBusy} onChange={setRating} />
        <NotesField value={notes} disabled={isBusy} onChange={setNotes} />

        {errorMessage && (
          <div role="alert" className="text-sm text-danger">
            {errorMessage}
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-1">
          <Button
            variant="primary"
            size="md"
            loading={isSaving}
            disabled={isBusy}
            onClick={handleSave}
          >
            {saveState === "saved" ? "Saved" : isSaving ? "Saving..." : "Save changes"}
          </Button>

          <DeleteConfirmation
            deleteState={deleteState}
            disabled={isBusy}
            onRequest={requestDelete}
            onConfirm={handleDelete}
            onCancel={cancelDelete}
          />
        </div>
      </div>
    </section>
  );
}
