"use client";

import { LibraryBookCard, type LibraryBook } from "./library-book-card";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BookCardWithSelectionProps {
  book: LibraryBook;
  selectionMode: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a LibraryBookCard. In selection mode, wraps it with a clickable
 * overlay and a visual checkbox indicator.
 */
export function BookCardWithSelection({
  book,
  selectionMode,
  selected,
  onToggle,
}: BookCardWithSelectionProps) {
  if (!selectionMode) {
    return <LibraryBookCard book={book} />;
  }

  return (
    <div
      className={cn(
        "relative cursor-pointer transition-all duration-150",
        selected && "ring-2 ring-accent rounded-[var(--radius-md)]",
      )}
      onClick={() => onToggle(book.id)}
      role="checkbox"
      aria-checked={selected}
      aria-label={`${selected ? "Deselect" : "Select"} ${book.title}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onToggle(book.id);
        }
      }}
    >
      <LibraryBookCard book={book} />

      {/* Checkbox overlay */}
      <div
        className={cn(
          "absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-150",
          selected
            ? "bg-accent border-accent text-white"
            : "bg-black/40 border-white/40 text-transparent",
        )}
      >
        <span className="material-symbols-outlined text-[14px]">check</span>
      </div>
    </div>
  );
}
