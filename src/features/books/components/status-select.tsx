import { cn } from "@/lib/cn";
import type { BookStatus } from "@/lib/types/book";
import { BOOK_STATUS_OPTIONS } from "@/lib/types/book";

interface StatusSelectProps {
  value: BookStatus;
  disabled?: boolean;
  onChange: (value: BookStatus) => void;
}

export function StatusSelect({ value, disabled = false, onChange }: StatusSelectProps) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wide text-muted">Status</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as BookStatus)}
        aria-label="Reading status"
        className={cn(
          "rounded-[var(--radius-sm)] border border-line bg-surface-soft text-text text-sm px-3 py-2.5",
          "focus:outline-none focus:border-accent/50",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          "transition-colors duration-150",
        )}
      >
        {BOOK_STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-bg text-text">
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
