"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/features/shared/components/skeleton";

interface StatsSnapshot {
  booksReadThisYear: number;
  readingStreak: { current: number; unit: string };
  averageRating: number | null;
  totalPagesRead: number;
}

export function DashboardStats() {
  const t = useTranslations("home");
  const [stats, setStats] = useState<StatsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/stats")
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json() as Promise<StatsSnapshot>;
      })
      .then(setStats)
      .catch(() => {
        /* non-critical — section simply won't render */
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const formattedRating =
    stats.averageRating != null ? stats.averageRating.toFixed(1) : "--";

  const formattedPages =
    stats.totalPagesRead >= 1000
      ? `${(stats.totalPagesRead / 1000).toFixed(1)}k`
      : String(stats.totalPagesRead);

  const cards = [
    {
      icon: "auto_stories",
      label: t("readThisYear"),
      value: stats.booksReadThisYear,
    },
    {
      icon: "local_fire_department",
      label: t("readingStreak"),
      value: `${stats.readingStreak.current}`,
      subtext: t("weeks"),
    },
    {
      icon: "star",
      label: t("avgRating"),
      value: formattedRating,
    },
    {
      icon: "description",
      label: t("pagesRead"),
      value: formattedPages,
    },
  ];

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-on-surface">{t("quickStats")}</h2>
        <Link
          href="/stats"
          className="text-primary text-sm font-semibold hover:underline"
        >
          {t("viewAllStats")}
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-outline-variant/15 bg-surface-container-low/60 p-4 flex flex-col gap-1.5"
            style={{ backdropFilter: "blur(8px)" }}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">
                {card.icon}
              </span>
              <span className="text-xs font-medium text-tertiary">
                {card.label}
              </span>
            </div>
            <p className="text-2xl font-bold font-headline text-on-surface">
              {card.value}
            </p>
            {card.subtext && (
              <p className="text-[10px] text-tertiary -mt-1">{card.subtext}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
