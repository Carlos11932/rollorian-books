"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { StatCard } from "@/features/stats/components/stat-card";
import { MonthlyChart } from "@/features/stats/components/monthly-chart";
import { GenreBars } from "@/features/stats/components/genre-bars";
import { ReadingStreak } from "@/features/stats/components/reading-streak";
import { Skeleton } from "@/features/shared/components/skeleton";

interface StatsData {
  booksByStatus: Record<string, number>;
  totalBooks: number;
  booksReadThisYear: number;
  booksReadByMonth: { month: string; count: number }[];
  averageRating: number | null;
  totalPagesRead: number;
  topGenres: { genre: string; count: number }[];
  readingStreak: { current: number; unit: "days" | "weeks" };
}

export default function StatsPage() {
  const t = useTranslations("stats");
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/stats")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load stats");
        return res.json() as Promise<StatsData>;
      })
      .then(setStats)
      .catch(() => setError("Failed to load stats"))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="pt-8 px-12 md:px-20 pb-24">
        <Skeleton variant="text" className="h-10 w-64 mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="card" className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton variant="card" className="h-56 rounded-2xl mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton variant="card" className="h-48 rounded-2xl" />
          <Skeleton variant="card" className="h-48 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error != null || stats == null) {
    return (
      <div className="pt-8 px-12 md:px-20 pb-24">
        <div className="flex flex-col items-center gap-4 mt-16 text-center">
          <span
            className="material-symbols-outlined text-on-surface-variant/40"
            style={{ fontSize: "64px" }}
          >
            bar_chart
          </span>
          <p className="text-lg font-medium text-on-surface-variant">
            {t("noData")}
          </p>
          <p className="text-sm text-outline">{t("startReading")}</p>
        </div>
      </div>
    );
  }

  const { totalBooks, booksReadThisYear, averageRating, totalPagesRead } =
    stats;

  const formattedRating =
    averageRating != null ? averageRating.toFixed(1) : "--";

  const formattedPages =
    totalPagesRead >= 1000
      ? `${(totalPagesRead / 1000).toFixed(1)}k`
      : String(totalPagesRead);

  return (
    <div className="pt-8 px-12 md:px-20 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <span
          className="material-symbols-outlined text-primary"
          style={{ fontSize: "32px" }}
        >
          bar_chart
        </span>
        <h1 className="text-3xl md:text-4xl font-bold text-on-surface tracking-tight font-headline">
          {t("title")}
        </h1>
      </div>

      {totalBooks === 0 ? (
        <div className="flex flex-col items-center gap-4 mt-16 text-center">
          <span
            className="material-symbols-outlined text-on-surface-variant/40"
            style={{ fontSize: "64px" }}
          >
            bar_chart
          </span>
          <p className="text-lg font-medium text-on-surface-variant">
            {t("noData")}
          </p>
          <p className="text-sm text-outline">{t("startReading")}</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon="menu_book"
              label={t("totalBooks")}
              value={totalBooks}
            />
            <StatCard
              icon="auto_stories"
              label={t("readThisYear")}
              value={booksReadThisYear}
            />
            <StatCard
              icon="star"
              label={t("averageRating")}
              value={formattedRating}
            />
            <StatCard
              icon="description"
              label={t("pagesRead")}
              value={formattedPages}
            />
          </div>

          {/* Monthly chart */}
          <div className="mb-6">
            <MonthlyChart
              data={stats.booksReadByMonth}
              title={t("booksPerMonth")}
            />
          </div>

          {/* Genre bars + Reading streak */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <GenreBars genres={stats.topGenres} title={t("topGenres")} />
            <ReadingStreak
              current={stats.readingStreak.current}
              unit={stats.readingStreak.unit}
            />
          </div>
        </>
      )}
    </div>
  );
}
