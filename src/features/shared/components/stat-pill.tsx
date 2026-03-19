import { cn } from "@/lib/cn";

interface StatPillProps {
  value: number | string;
  label: string;
  className?: string;
}

export function StatPill({ value, label, className }: StatPillProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/6 border border-line text-sm",
        className,
      )}
    >
      <span className="font-bold text-text">{value}</span>
      <span className="text-muted">{label}</span>
    </div>
  );
}
