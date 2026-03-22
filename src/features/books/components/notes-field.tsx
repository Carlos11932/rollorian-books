import { cn } from "@/lib/cn";

interface NotesFieldProps {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function NotesField({ value, disabled = false, onChange }: NotesFieldProps) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wide text-muted">Notes</span>
      <textarea
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write something useful about this book."
        rows={4}
        aria-label="Book notes"
        className={cn(
          "rounded-[var(--radius-sm)] border border-line bg-surface-soft text-text text-sm px-3 py-2.5",
          "placeholder:text-muted resize-y leading-relaxed",
          "focus:outline-none focus:border-accent/50",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          "transition-colors duration-150",
        )}
      />
    </label>
  );
}
