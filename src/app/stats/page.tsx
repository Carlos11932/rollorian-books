import { getTranslations } from "next-intl/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { getStats } from "@/lib/stats/get-stats";
import { StatCard } from "@/features/stats/components/stat-card";
import { MonthlyChart } from "@/features/stats/components/monthly-chart";
import { GenreBars } from "@/features/stats/components/genre-bars";
import { ReadingStreak } from "@/features/stats/components/reading-streak";

export default async function StatsPage() {
  const t = await getTranslations("stats");

  let stats;
  try {
    const { userId } = await requireAuth();
    stats = await getStats(userId);
  } catch {
    return (
      <div className="pt-8 px-12 md:px-20 pb-24">
        <div className="flex flex-col items-center gap-4 mt-16 text-center">
          <span className="material-symbols-outlined text-on-surface-variant/40 text-[64px]">
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

  const { totalBooks, booksReadThisYear, averageRating, totalPagesRead } = stats;

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
        <span className="material-symbols-outlined text-primary text-[32px]">
          bar_chart
        </span>
        <h1 className="text-3xl md:text-4xl font-bold text-on-surface tracking-tight font-headline">
          {t("title")}
        </h1>
      </div>

      {totalBooks === 0 ? (
        <div className="flex flex-col items-center gap-4 mt-16 text-center">
          <span className="material-symbols-outlined text-on-surface-variant/40 text-[64px]">
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
