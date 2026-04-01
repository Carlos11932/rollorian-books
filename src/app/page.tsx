import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { BookStatus } from "@/lib/types/book";
import { getLibrary } from "@/lib/books";
import { getAuthenticatedUserIdOrNull } from "@/lib/auth/require-auth";
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

  // ── Global empty state (brand new user) ──────────────────────────────
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

  // ── Group books by status ────────────────────────────────────────────
  const serialized: LibraryEntryView[] = userBooks.map(toLibraryEntryView);

  const byStatus: Record<BookStatus, LibraryEntryView[]> = {
    READING: [],
    REREADING: [],
    TO_READ: [],
    READ: [],
    ON_HOLD: [],
    WISHLIST: [],
  };

  for (const book of serialized) {
    byStatus[book.status].push(book);
  }

  const currentlyReading = [...byStatus.READING, ...byStatus.REREADING];

  return (
    <div className="px-6 md:px-12 lg:px-20 pt-8 pb-24 space-y-10 max-w-7xl">
      {/* 1. Hero — Currently Reading */}
      <ReadingHero
        books={currentlyReading}
        hasToRead={byStatus.TO_READ.length > 0}
      />

      {/* 2. Quick Stats */}
      <DashboardStats />

      {/* 3. Active loans */}
      <DashboardLoans />

      {/* 4. Recommendations (client-side fetch) */}
      <DashboardRecommendations />

      {/* 4. Up Next — TO_READ */}
      <DashboardBookRail
        title={t("home.upNext")}
        books={byStatus.TO_READ}
        emptyMessage={t("home.upNextEmpty")}
        status="TO_READ"
        icon="playlist_play"
      />

      {/* 5. On Hold — conditional */}
      <DashboardBookRail
        title={t("home.onHold")}
        books={byStatus.ON_HOLD}
        emptyMessage={t("home.onHoldEmpty")}
        status="ON_HOLD"
        icon="pause_circle"
      />

      {/* 6. Wishlist — conditional */}
      <DashboardBookRail
        title={t("home.wishlist")}
        books={byStatus.WISHLIST}
        emptyMessage={t("home.wishlistEmpty")}
        status="WISHLIST"
        icon="favorite"
      />
    </div>
  );
}
