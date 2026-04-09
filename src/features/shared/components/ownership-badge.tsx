"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { type OwnershipStatus } from "@/lib/types/book";

interface OwnershipBadgeProps {
  status: OwnershipStatus;
  className?: string;
}

export function OwnershipBadge({ status, className }: OwnershipBadgeProps) {
  const t = useTranslations("book");

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border",
        status === "OWNED" && "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
        status === "NOT_OWNED" && "bg-white/8 text-muted border-white/10",
        status === "UNKNOWN" && "bg-white/5 text-white/30 border-white/5",
        className,
      )}
    >
      {t(`ownership.${status}`)}
    </span>
  );
}
