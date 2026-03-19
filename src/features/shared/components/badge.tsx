import { cn } from "@/lib/cn";

const BOOK_STATUS = {
  READING: "READING",
  READ: "READ",
  TO_READ: "TO_READ",
  WISHLIST: "WISHLIST",
} as const;

type BookStatus = (typeof BOOK_STATUS)[keyof typeof BOOK_STATUS];

const STATUS_LABEL: Record<BookStatus, string> = {
  READING: "Reading",
  READ: "Read",
  TO_READ: "To Read",
  WISHLIST: "Wishlist",
};

interface BadgeProps {
  status: BookStatus;
  className?: string;
}

export function Badge({ status, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border",
        status === "READING" && "bg-accent/15 text-accent border-accent/25",
        status === "READ" && "bg-success/15 text-success border-success/25",
        status === "TO_READ" && "bg-gold/15 text-gold border-gold/25",
        status === "WISHLIST" && "bg-white/8 text-muted border-line",
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export type { BookStatus };
