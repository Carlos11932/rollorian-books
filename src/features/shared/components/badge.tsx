'use client';

import { useTranslations } from 'next-intl';
import { cn } from "@/lib/cn";
import { type BookStatus } from "@/lib/types/book";

interface BadgeProps {
  status: BookStatus;
  className?: string;
}

export function Badge({ status, className }: BadgeProps) {
  const t = useTranslations('book');

  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border",
        status === "READING" && "bg-accent/15 text-accent border-accent/25",
        status === "REREADING" && "bg-accent/15 text-accent border-accent/25",
        status === "READ" && "bg-success/15 text-success border-success/25",
        status === "TO_READ" && "bg-gold/15 text-gold border-gold/25",
        status === "WISHLIST" && "bg-white/8 text-muted border-line",
        status === "ON_HOLD" && "bg-orange-500/15 text-orange-400 border-orange-500/25",
        className,
      )}
    >
      {t(`status.${status}`)}
    </span>
  );
}
