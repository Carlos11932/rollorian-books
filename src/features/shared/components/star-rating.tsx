"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

const RATING_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Great",
  5: "Excellent",
};

interface StarRatingProps {
  value: number | null;
  disabled?: boolean;
  onChange: (value: number | null) => void;
}

export function StarRating({ value, disabled = false, onChange }: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const displayRating = hoverRating ?? value;

  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wide text-muted">
        Rating{displayRating !== null ? ` — ${RATING_LABELS[displayRating]}` : ""}
      </span>
      <div
        className="flex gap-1"
        role="group"
        aria-label="Book rating"
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={disabled}
            onClick={() => onChange(value === star ? null : star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(null)}
            aria-label={`Rate ${star} out of 5 — ${RATING_LABELS[star]}`}
            aria-pressed={value === star}
            className={cn(
              "text-2xl transition-all duration-100 cursor-pointer",
              "hover:scale-110 active:scale-95",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-sm",
              "disabled:cursor-not-allowed disabled:opacity-60",
              displayRating !== null && star <= displayRating
                ? "text-gold"
                : "text-muted/40",
            )}
          >
            ★
          </button>
        ))}
        {value !== null && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            aria-label="Clear rating"
            className="ml-2 text-xs text-muted hover:text-text transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-sm disabled:opacity-60 self-center"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
