import "server-only";

import { prisma } from "@/lib/prisma";
import {
  isMissingFinishedAtError,
  isMissingUserBookSchemaError,
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

  return {
    booksByStatus, totalBooks, booksReadThisYear, booksReadByMonth,
    averageRating, totalPagesRead, topGenres, readingStreak,
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

  return {
    booksByStatus, totalBooks, booksReadThisYear, booksReadByMonth,
    averageRating, totalPagesRead, topGenres, readingStreak,
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
