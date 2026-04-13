import "server-only";

import { prisma } from "@/lib/prisma";
import {
  isMissingFinishedAtError,
  isMissingUserBookSchemaError,
  isPrismaSchemaMismatchError,
} from "@/lib/prisma-schema-compat";

// ── Types ───────────────────────────────────────────────────────────────────

export interface StatsSnapshot {
  booksByStatus: Record<string, number>;
  totalBooks: number;
  booksReadThisYear: number;
  booksReadByMonth: { month: string; count: number }[];
  averageRating: number | null;
  totalPagesRead: number;
  topGenres: { genre: string; count: number }[];
  readingStreak: { current: number; unit: "weeks" };
  // Collection / ownership stats
  booksOwned: number;
  booksNotSpecified: number;
  booksAvailableToLend: number;
  booksCurrentlyLent: number;
}

const EMPTY_STATS: StatsSnapshot = {
  booksByStatus: {
    WISHLIST: 0, TO_READ: 0, READING: 0, REREADING: 0, READ: 0, ON_HOLD: 0,
  },
  totalBooks: 0,
  booksReadThisYear: 0,
  booksReadByMonth: [],
  averageRating: null,
  totalPagesRead: 0,
  topGenres: [],
  readingStreak: { current: 0, unit: "weeks" },
  booksOwned: 0,
  booksNotSpecified: 0,
  booksAvailableToLend: 0,
  booksCurrentlyLent: 0,
};

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Computes reading statistics for a user.
 * Reusable from both the API route and server components.
 */
export async function getStats(userId: string): Promise<StatsSnapshot> {
  try {
    return await getStatsUsingFinishedAt(userId);
  } catch (error) {
    if (isMissingFinishedAtError(error)) {
      return getLegacyStatsUsingUpdatedAt(userId);
    }
    if (isMissingUserBookSchemaError(error)) {
      return EMPTY_STATS;
    }
    throw error;
  }
}

// ── Internals ───────────────────────────────────────────────────────────────

async function getStatsUsingFinishedAt(userId: string): Promise<StatsSnapshot> {
  const statusGroups = await prisma.userBook.groupBy({
    by: ["status"],
    _count: true,
    where: { userId },
  });

  const booksByStatus: Record<string, number> = {
    WISHLIST: 0, TO_READ: 0, READING: 0, REREADING: 0, READ: 0, ON_HOLD: 0,
  };
  for (const group of statusGroups) {
    booksByStatus[group.status] = group._count;
  }
  const totalBooks = Object.values(booksByStatus).reduce((a, b) => a + b, 0);

  const startOfYear = new Date(new Date().getFullYear(), 0, 1);
  const booksReadThisYear = await prisma.userBook.count({
    where: { userId, status: "READ", finishedAt: { gte: startOfYear } },
  });

  const ratingAgg = await prisma.userBook.aggregate({
    _avg: { rating: true },
    where: { userId, rating: { not: null } },
  });
  const averageRating = ratingAgg._avg.rating ?? null;

  const readBooks = await prisma.userBook.findMany({
    where: { userId, status: "READ" },
    select: { book: { select: { pageCount: true } } },
  });
  const totalPagesRead = readBooks.reduce(
    (sum, ub) => sum + (ub.book.pageCount ?? 0), 0,
  );

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const readBooksLastYear = await prisma.userBook.findMany({
    where: { userId, status: "READ", finishedAt: { gte: twelveMonthsAgo } },
    select: { finishedAt: true },
  });

  const monthCounts = new Map<string, number>();
  for (const ub of readBooksLastYear) {
    if (!ub.finishedAt) continue;
    const d = new Date(ub.finishedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }

  const booksReadByMonth: { month: string; count: number }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    booksReadByMonth.push({ month: key, count: monthCounts.get(key) ?? 0 });
  }

  const readBooksWithGenres = await prisma.userBook.findMany({
    where: { userId, status: "READ" },
    select: { book: { select: { genres: true } } },
  });

  const genreCounts = new Map<string, number>();
  for (const ub of readBooksWithGenres) {
    for (const genre of ub.book.genres) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
  }

  const topGenres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([genre, count]) => ({ genre, count }));

  const allReadDates = await prisma.userBook.findMany({
    where: { userId, status: "READ" },
    select: { finishedAt: true },
    orderBy: { finishedAt: "desc" },
  });

  const readingStreak = computeWeeklyStreak(
    allReadDates.flatMap((record) => (record.finishedAt ? [record.finishedAt] : [])),
  );

  // ── Collection stats ──────────────────────────────────────────────────────

  let booksOwned = 0;
  let booksNotSpecified = 0;
  let booksAvailableToLend = 0;
  let booksCurrentlyLent = 0;

  try {
    booksOwned = await prisma.userBook.count({
      where: { userId, ownershipStatus: "OWNED" },
    });

    booksNotSpecified = await prisma.userBook.count({
      where: { userId, ownershipStatus: "UNKNOWN" },
    });

    // Books the user owns that have NO active loan where they are the lender
    // (ACTIVE, REQUESTED, or OFFERED counts as "not available")
    const ownedUserBooks = await prisma.userBook.findMany({
      where: { userId, ownershipStatus: "OWNED" },
      select: { bookId: true },
    });
    const ownedBookIds = ownedUserBooks.map((ub) => ub.bookId);

    if (ownedBookIds.length > 0) {
      // Books with any active/pending loan (user is lender)
      const activeLoanBookIds = await prisma.loan.findMany({
        where: {
          lenderId: userId,
          bookId: { in: ownedBookIds },
          status: { in: ["ACTIVE", "REQUESTED", "OFFERED"] },
        },
        select: { bookId: true },
      });
      const activeLoanSet = new Set(activeLoanBookIds.map((l) => l.bookId));

      // Books with a strictly ACTIVE loan (currently lent out)
      const currentlyLentBookIds = await prisma.loan.findMany({
        where: {
          lenderId: userId,
          bookId: { in: ownedBookIds },
          status: "ACTIVE",
        },
        select: { bookId: true },
      });
      const currentlyLentSet = new Set(currentlyLentBookIds.map((l) => l.bookId));

      booksAvailableToLend = ownedBookIds.filter((id) => !activeLoanSet.has(id)).length;
      booksCurrentlyLent = currentlyLentSet.size;
    }
  } catch (error) {
    if (!isPrismaSchemaMismatchError(error)) throw error;
    // Column doesn't exist yet — return zeroed collection stats
  }

  return {
    booksByStatus, totalBooks, booksReadThisYear, booksReadByMonth,
    averageRating, totalPagesRead, topGenres, readingStreak,
    booksOwned, booksNotSpecified, booksAvailableToLend, booksCurrentlyLent,
  };
}

async function getLegacyStatsUsingUpdatedAt(userId: string): Promise<StatsSnapshot> {
  const statusGroups = await prisma.userBook.groupBy({
    by: ["status"], _count: true, where: { userId },
  });

  const booksByStatus: Record<string, number> = {
    WISHLIST: 0, TO_READ: 0, READING: 0, REREADING: 0, READ: 0, ON_HOLD: 0,
  };
  for (const group of statusGroups) {
    booksByStatus[group.status] = group._count;
  }
  const totalBooks = Object.values(booksByStatus).reduce((a, b) => a + b, 0);

  const startOfYear = new Date(new Date().getFullYear(), 0, 1);
  const booksReadThisYear = await prisma.userBook.count({
    where: { userId, status: "READ", updatedAt: { gte: startOfYear } },
  });

  const ratingAgg = await prisma.userBook.aggregate({
    _avg: { rating: true },
    where: { userId, rating: { not: null } },
  });
  const averageRating = ratingAgg._avg.rating ?? null;

  const readBooks = await prisma.userBook.findMany({
    where: { userId, status: "READ" },
    select: { book: { select: { pageCount: true } } },
  });
  const totalPagesRead = readBooks.reduce(
    (sum, ub) => sum + (ub.book.pageCount ?? 0), 0,
  );

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const readBooksLastYear = await prisma.userBook.findMany({
    where: { userId, status: "READ", updatedAt: { gte: twelveMonthsAgo } },
    select: { updatedAt: true },
  });

  const monthCounts = new Map<string, number>();
  for (const ub of readBooksLastYear) {
    const d = new Date(ub.updatedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }

  const booksReadByMonth: { month: string; count: number }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    booksReadByMonth.push({ month: key, count: monthCounts.get(key) ?? 0 });
  }

  const readBooksWithGenres = await prisma.userBook.findMany({
    where: { userId, status: "READ" },
    select: { book: { select: { genres: true } } },
  });

  const genreCounts = new Map<string, number>();
  for (const ub of readBooksWithGenres) {
    for (const genre of ub.book.genres) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
  }

  const topGenres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([genre, count]) => ({ genre, count }));

  const allReadDates = await prisma.userBook.findMany({
    where: { userId, status: "READ" },
    select: { updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  const readingStreak = computeWeeklyStreak(allReadDates.map((r) => r.updatedAt));

  // ── Collection stats ──────────────────────────────────────────────────────

  let booksOwned = 0;
  let booksNotSpecified = 0;
  let booksAvailableToLend = 0;
  let booksCurrentlyLent = 0;

  try {
    booksOwned = await prisma.userBook.count({
      where: { userId, ownershipStatus: "OWNED" },
    });

    booksNotSpecified = await prisma.userBook.count({
      where: { userId, ownershipStatus: "UNKNOWN" },
    });

    const ownedUserBooks = await prisma.userBook.findMany({
      where: { userId, ownershipStatus: "OWNED" },
      select: { bookId: true },
    });
    const ownedBookIds = ownedUserBooks.map((ub) => ub.bookId);

    if (ownedBookIds.length > 0) {
      const activeLoanBookIds = await prisma.loan.findMany({
        where: {
          lenderId: userId,
          bookId: { in: ownedBookIds },
          status: { in: ["ACTIVE", "REQUESTED", "OFFERED"] },
        },
        select: { bookId: true },
      });
      const activeLoanSet = new Set(activeLoanBookIds.map((l) => l.bookId));

      const currentlyLentBookIds = await prisma.loan.findMany({
        where: {
          lenderId: userId,
          bookId: { in: ownedBookIds },
          status: "ACTIVE",
        },
        select: { bookId: true },
      });
      const currentlyLentSet = new Set(currentlyLentBookIds.map((l) => l.bookId));

      booksAvailableToLend = ownedBookIds.filter((id) => !activeLoanSet.has(id)).length;
      booksCurrentlyLent = currentlyLentSet.size;
    }
  } catch (error) {
    if (!isPrismaSchemaMismatchError(error)) throw error;
    // Column doesn't exist yet — return zeroed collection stats
  }

  return {
    booksByStatus, totalBooks, booksReadThisYear, booksReadByMonth,
    averageRating, totalPagesRead, topGenres, readingStreak,
    booksOwned, booksNotSpecified, booksAvailableToLend, booksCurrentlyLent,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function computeWeeklyStreak(dates: Date[]): { current: number; unit: "weeks" } {
  if (dates.length === 0) return { current: 0, unit: "weeks" };
  const weekKeys = new Set(dates.map(getWeekKey));
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const key = getWeekKey(cursor);
    if (weekKeys.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 7);
    } else {
      break;
    }
  }
  return { current: streak, unit: "weeks" };
}
