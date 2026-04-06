import "server-only";

import { prisma } from "@/lib/prisma";
import {
  isMissingSocialSchemaError,
  isMissingUserBookSchemaError,
} from "@/lib/prisma-schema-compat";
import { getViewableUserIds } from "@/lib/privacy/can-view-user-books";

// ── Types ───────────────────────────────────────────────────────────────────

export interface RecommendedBook {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  isbn13: string | null;
  genres: string[];
}

export interface Recommendation {
  book: RecommendedBook;
  readerCount: number;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Generates book recommendations for a user based on shared readers,
 * follows, and group memberships. NOT cached — depends on dynamic auth.
 *
 * Reusable from both the API route and server components.
 */
export async function getRecommendations(userId: string): Promise<Recommendation[]> {
  const userBookIds = await prisma.userBook.findMany({
    where: { userId },
    select: { bookId: true },
  });
  const myBookIds = new Set(userBookIds.map((ub) => ub.bookId));

  if (myBookIds.size === 0) return [];

  // Find similar readers from three sources
  const sharedBookUsers = await prisma.userBook.groupBy({
    by: ["userId"],
    where: {
      bookId: { in: [...myBookIds] },
      userId: { not: userId },
    },
    _count: true,
    having: { userId: { _count: { gte: 1 } } },
  });

  let followingIds: string[] = [];
  try {
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    followingIds = following.map((f) => f.followingId);
  } catch (error) {
    if (!isMissingSocialSchemaError(error)) throw error;
  }

  let groupMemberIds: string[] = [];
  try {
    const myGroups = await prisma.groupMember.findMany({
      where: { userId, status: "ACCEPTED" },
      select: { groupId: true },
    });
    if (myGroups.length > 0) {
      const groupMembers = await prisma.groupMember.findMany({
        where: {
          groupId: { in: myGroups.map((g) => g.groupId) },
          userId: { not: userId },
          status: "ACCEPTED",
        },
        select: { userId: true },
      });
      groupMemberIds = groupMembers.map((m) => m.userId);
    }
  } catch (error) {
    if (!isMissingSocialSchemaError(error)) throw error;
  }

  const similarReaderIds = new Set([
    ...sharedBookUsers.map((u) => u.userId),
    ...followingIds,
    ...groupMemberIds,
  ]);

  const allowedReaderIds = [
    ...await getViewableUserIds(userId, [...similarReaderIds]),
  ];

  if (allowedReaderIds.length === 0) return [];

  const myBookIdArray = [...myBookIds];
  const candidateBooks = await prisma.userBook.findMany({
    where: {
      userId: { in: allowedReaderIds },
      status: { in: ["READ", "READING"] },
      bookId: { notIn: myBookIdArray },
    },
    select: {
      bookId: true,
      book: {
        select: {
          id: true, title: true, authors: true,
          coverUrl: true, isbn13: true, genres: true,
        },
      },
    },
  });

  const bookCounts = new Map<string, { book: RecommendedBook; count: number }>();
  for (const ub of candidateBooks) {
    const existing = bookCounts.get(ub.bookId);
    if (existing) {
      existing.count++;
    } else {
      bookCounts.set(ub.bookId, { book: ub.book, count: 1 });
    }
  }

  return [...bookCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
    .map(({ book, count }) => ({ book, readerCount: count }));
}

/**
 * Safe wrapper that returns empty array on schema errors.
 * Useful for server components where we can't return HTTP error codes.
 */
export async function getRecommendationsSafe(userId: string): Promise<Recommendation[]> {
  try {
    return await getRecommendations(userId);
  } catch (error) {
    if (isMissingUserBookSchemaError(error)) return [];
    if (isMissingSocialSchemaError(error)) return [];
    throw error;
  }
}
