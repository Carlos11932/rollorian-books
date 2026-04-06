"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BOOK_STATUS_VALUES, type BookStatus } from "@/lib/types/book";
import { cn } from "@/lib/cn";

interface SelectionToolbarProps {
  selectedCount: number;
  onBatchStatusChange: (status: BookStatus) => Promise<void>;
  onDeselectAll: () => void;
}

export function SelectionToolbar({
  selectedCount,
  onBatchStatusChange,
  onDeselectAll,
}: SelectionToolbarProps) {
  const t = useTranslations();
  const [loading, setLoading] = useState<BookStatus | null>(null);

  async function handleClick(status: BookStatus) {
    setLoading(status);
    try {
      await onBatchStatusChange(status);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div
      className={cn(
        "fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40",
        "flex items-center gap-3 px-5 py-3 rounded-2xl",
        "bg-surface/95 border border-line shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
        "backdrop-blur-xl",
        "animate-[fade-slide-up_250ms_ease_both]",
      )}
    >
      {/* Count + deselect */}
      <div className="flex items-center gap-2 pr-3 border-r border-line">
        <span className="text-sm font-bold text-accent tabular-nums">
          {t("library.selectedCount", { count: selectedCount })}
        </span>
        <button
          type="button"
          onClick={onDeselectAll}
          className="text-xs text-muted hover:text-text transition-colors"
        >
          {t("library.deselectAll")}
        </button>
      </div>

      {/* Status action pills */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted font-medium mr-1">
          {t("library.moveTo")}:
        </span>
        {BOOK_STATUS_VALUES.map((status) => (
          <button
            key={status}
            type="button"
            disabled={loading !== null}
            onClick={() => void handleClick(status)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-150",
              "border focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
              loading === status
                ? "bg-accent/20 text-accent border-accent/30 opacity-60 cursor-wait"
                : "bg-white/6 text-muted border-white/12 hover:text-text hover:border-white/25 hover:-translate-y-px",
            )}
          >
            {loading === status ? "…" : t(`book.status.${status}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
