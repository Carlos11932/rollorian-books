import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { BookStatus } from "@/lib/types/book";
import { getLibrary } from "@/lib/books";
import { getAuthenticatedUserIdOrNull } from "@/lib/auth/require-auth";
import { getStats } from "@/lib/stats/get-stats";
import { getRecommendationsSafe } from "@/lib/recommendations/get-recommendations";
import { getUserLoans } from "@/lib/loans";
import { EmptyState } from "@/features/shared/components/empty-state";
import { Button } from "@/features/shared/components/button";
import { toLibraryEntryView, type LibraryEntryView } from "@/features/books/types";
import { ReadingHero } from "@/features/dashboard/components/reading-hero";
import { DashboardBookRail } from "@/features/dashboard/components/dashboard-book-rail";
import { DashboardStats } from "@/features/dashboard/components/dashboard-stats";
import { DashboardRecommendations } from "@/features/dashboard/components/dashboard-recommendations";
import { DashboardLoans } from "@/features/loans/components/dashboard-loans";

export default async function Home() {
  const t = await getTranslations();

  const userId = await getAuthenticatedUserIdOrNull();
  if (!userId) {
    redirect("/login");
  }

  const userBooks = await getLibrary(userId);

  // Global empty state (brand new user)
  if (userBooks.length === 0) {
    return (
      <EmptyState
        icon="📚"
        title={t("home.emptyTitle")}
        description={t("home.emptyDescription")}
        action={
          <Link href="/search">
            <Button variant="primary">{t("home.emptyAction")}</Button>
          </Link>
        }
        className="mt-8 min-h-[60vh]"
      />
    );
  }

  // Fetch dashboard data server-side in parallel — no client round-trips
  const [stats, recommendations, { loans }] = await Promise.all([
    getStats(userId),
    getRecommendationsSafe(userId),
    getUserLoans(userId).then((loans) => ({ loans })),
  ]);

  // Group books by status
  const serialized: LibraryEntryView[] = userBooks.map(toLibraryEntryView);

  const byStatus: Record<BookStatus, LibraryEntryView[]> = {
    READING: [], REREADING: [], TO_READ: [], READ: [], ON_HOLD: [], WISHLIST: [],
  };

  for (const book of serialized) {
    byStatus[book.status].push(book);
  }

  const currentlyReading = [...byStatus.READING, ...byStatus.REREADING];

  return (
    <div className="px-6 md:px-12 lg:px-20 pt-8 pb-24 space-y-10 max-w-7xl">
      <ReadingHero books={currentlyReading} hasToRead={byStatus.TO_READ.length > 0} />

      {/* Server-rendered — no client HTTP round-trips */}
      <DashboardStats stats={stats} />
      <DashboardLoans loans={loans} />
      <DashboardRecommendations recommendations={recommendations} />

      <DashboardBookRail
        title={t("home.upNext")} books={byStatus.TO_READ}
        emptyMessage={t("home.upNextEmpty")} status="TO_READ" icon="playlist_play"
      />
      <DashboardBookRail
        title={t("home.onHold")} books={byStatus.ON_HOLD}
        emptyMessage={t("home.onHoldEmpty")} status="ON_HOLD" icon="pause_circle"
      />
      <DashboardBookRail
        title={t("home.wishlist")} books={byStatus.WISHLIST}
        emptyMessage={t("home.wishlistEmpty")} status="WISHLIST" icon="favorite"
      />
    </div>
  );
}
