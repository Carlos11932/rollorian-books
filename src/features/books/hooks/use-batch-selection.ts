"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BookStatus } from "@/lib/types/book";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal shape needed for batch select operations */
export interface SelectableBook {
  id: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface BatchSelection {
  selectionMode: boolean;
  selectedIds: Set<string>;
  enterSelectionMode: () => void;
  exitSelectionMode: () => void;
  toggleSelect: (bookId: string) => void;
  selectAll: (books: SelectableBook[]) => void;
  deselectAll: () => void;
  handleBatchStatusChange: (status: BookStatus) => Promise<void>;
}

/**
 * Manages multi-select state and the batch PATCH /api/books/batch API call.
 */
export function useBatchSelection(): BatchSelection {
  const router = useRouter();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function enterSelectionMode(): void {
    setSelectionMode(true);
  }

  function exitSelectionMode(): void {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  function toggleSelect(bookId: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) {
        next.delete(bookId);
      } else {
        next.add(bookId);
      }
      return next;
    });
  }

  function selectAll(books: SelectableBook[]): void {
    setSelectedIds(new Set(books.map((b) => b.id)));
  }

  function deselectAll(): void {
    setSelectedIds(new Set());
  }

  async function handleBatchStatusChange(status: BookStatus): Promise<void> {
    if (selectedIds.size === 0) return;

    const res = await fetch("/api/books/batch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookIds: Array.from(selectedIds),
        status,
      }),
    });

    if (res.ok) {
      exitSelectionMode();
      router.refresh();
    }
  }

  return {
    selectionMode,
    selectedIds,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelect,
    selectAll,
    deselectAll,
    handleBatchStatusChange,
  };
}
