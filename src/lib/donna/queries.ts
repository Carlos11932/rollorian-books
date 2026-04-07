import "server-only";

import { prisma } from "@/lib/prisma";
import {
  isMissingListsSchemaError,
  isMissingUserBookSchemaError,
} from "@/lib/prisma-schema-compat";
import { getLibraryEntriesForUser } from "./normalize";
import { getDonnaUserContext } from "./user";

export function computeWeeklyStreak(dates: Date[]): { current: number; unit: "weeks" } {
  if (dates.length === 0) {
    return { current: 0, unit: "weeks" };
  }

  const weeks = new Set<string>();
  for (const date of dates) {
    const copy = new Date(date);
    const day = copy.getUTCDay() || 7;
    copy.setUTCDate(copy.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    weeks.add(`${copy.getUTCFullYear()}-${String(week).padStart(2, "0")}`);
  }

  let current = 0;
  const cursor = new Date();
  while (true) {
    const day = cursor.getUTCDay() || 7;
    cursor.setUTCDate(cursor.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(cursor.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((cursor.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    const key = `${cursor.getUTCFullYear()}-${String(week).padStart(2, "0")}`;

    if (!weeks.has(key)) {
      break;
    }
    current += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }

  return { current, unit: "weeks" };
}

export async function getDonnaStatus() {
  const user = await getDonnaUserContext();
  const libraryCount = await prisma.userBook.count({ where: { userId: user.userId } }).catch(() => 0);

  return {
    ok: true,
    owner: user,
    contractVersion: "v1",
    libraryCount,
    generatedAt: new Date().toISOString(),
  };
}

export async function getDonnaSummary() {
  const user = await getDonnaUserContext();
  const entries = await getLibraryEntriesForUser(user.userId).catch((error) => {
    if (isMissingUserBookSchemaError(error)) {
      return [];
    }
    throw error;
  });

  let activeLists: Array<{ id: string; name: string; description: string | null; itemCount: number }> = [];
  try {
    activeLists = (await prisma.bookList.findMany({
      where: { userId: user.userId },
      include: { _count: { select: { items: true } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    })).map((list) => ({
      id: list.id,
      name: list.name,
      description: list.description ?? null,
      itemCount: list._count.items,
    }));
  } catch (error) {
    if (!isMissingListsSchemaError(error)) {
      throw error;
    }
  }

  const rated = entries.filter((entry) => entry.rating != null).map((entry) => entry.rating as number);
  const readDates = entries
    .filter((entry) => entry.semanticState === "read")
    .map((entry) => new Date(entry.finishedAt ?? entry.updatedAt));

  const genreCounts = new Map<string, number>();
  const authorCounts = new Map<string, number>();
  for (const entry of entries.filter((item) =>
    item.semanticState === "read"
    || item.semanticState === "reading"
    || item.semanticState === "rereading"
  )) {
    for (const genre of entry.book.genres) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
    for (const author of entry.book.authors) {
      authorCounts.set(author, (authorCounts.get(author) ?? 0) + 1);
    }
  }

  const byUpdatedAt = [...entries].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return {
    owner: user,
    currentlyReading: byUpdatedAt.filter((entry) => entry.semanticState === "reading" || entry.semanticState === "rereading").slice(0, 5),
    recentlyFinished: byUpdatedAt.filter((entry) => entry.semanticState === "read").slice(0, 5),
    wishlistHighlights: byUpdatedAt.filter((entry) => entry.semanticState === "wishlist" || entry.semanticState === "to_read").slice(0, 5),
    topGenres: [...genreCounts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5).map(([genre, count]) => ({ genre, count })),
    topAuthors: [...authorCounts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5).map(([author, count]) => ({ author, count })),
    readingStreak: computeWeeklyStreak(readDates),
    averageRating: rated.length === 0 ? null : Math.round((rated.reduce((sum, value) => sum + value, 0) / rated.length) * 100) / 100,
    abandonedCount: entries.filter((entry) => entry.semanticState === "abandoned").length,
    activeLists,
    profileUpdatedAt: byUpdatedAt[0]?.updatedAt ?? new Date().toISOString(),
  };
}

export async function getDonnaLibrarySnapshot() {
  const user = await getDonnaUserContext();
  const items = await getLibraryEntriesForUser(user.userId);
  return {
    owner: user,
    total: items.length,
    items,
    generatedAt: new Date().toISOString(),
  };
}

export async function getDonnaLists() {
  const { userId } = await getDonnaUserContext();

  try {
    const lists = await prisma.bookList.findMany({
      where: { userId },
      include: { _count: { select: { items: true } } },
      orderBy: { updatedAt: "desc" },
    });

    return {
      total: lists.length,
      lists: lists.map((list) => ({
        id: list.id,
        name: list.name,
        description: list.description ?? null,
        itemCount: list._count.items,
        createdAt: list.createdAt.toISOString(),
        updatedAt: list.updatedAt.toISOString(),
      })),
    };
  } catch (error) {
    if (isMissingListsSchemaError(error)) {
      return { total: 0, lists: [] };
    }
    throw error;
  }
}
