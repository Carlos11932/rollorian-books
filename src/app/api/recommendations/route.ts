import "server-only";

import { prisma } from "@/lib/prisma";
import {
  isMissingSocialSchemaError,
  isMissingUserBookSchemaError,
} from "@/lib/prisma-schema-compat";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";
import { canViewUserBooks } from "@/lib/privacy/can-view-user-books";

// ── Types ───────────────────────────────────────────────────────────────────

interface RecommendedBook {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  isbn13: string | null;
  genres: string[];
}

interface Recommendation {
  book: RecommendedBook;
  readerCount: number;
}

// ── Cached recommendation engine ────────────────────────────────────────────

/**
 * Recommendations are NOT cached because the result depends on dynamic
 * authorization (follows, group memberships). Caching auth-dependent data
 * risks exposing books from connections that were since removed.
 */
async function getRecommendations(userId: string): Promise<Recommendation[]> {
  // Step 1: Get the current user's book IDs
  const userBookIds = await prisma.userBook.findMany({
    where: { userId },
    select: { bookId: true },
  });
  const myBookIds = new Set(userBookIds.map((ub) => ub.bookId));

  if (myBookIds.size === 0) {
    return [];
  }

  // Step 2: Find similar readers from three sources

  // 2a: Users who share 1+ books with the current user
  const sharedBookUsers = await prisma.userBook.groupBy({
    by: ["userId"],
    where: {
      bookId: { in: [...myBookIds] },
      userId: { not: userId },
    },
    _count: true,
    having: { userId: { _count: { gte: 1 } } },
  });

  // 2b: Users the current user follows
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

  // 2c: Users in the same groups (accepted members only)
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

  // Combine all similar reader IDs (union)
  const similarReaderIds = new Set([
    ...sharedBookUsers.map((u) => u.userId),
    ...followingIds,
    ...groupMemberIds,
  ]);

  const allowedReaderIds = (
    await Promise.all(
      [...similarReaderIds].map(async (readerId) =>
        (await canViewUserBooks(userId, readerId)) ? readerId : null,
      ),
    )
  ).filter((readerId): readerId is string => readerId !== null);

  if (allowedReaderIds.length === 0) {
    return [];
  }

  // Step 3: Get books those similar readers have that I don't
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
          id: true,
          title: true,
          authors: true,
          coverUrl: true,
          isbn13: true,
          genres: true,
        },
      },
    },
  });

  // Step 4: Count frequency and rank
  const bookCounts = new Map<string, { book: RecommendedBook; count: number }>();
  for (const ub of candidateBooks) {
    const existing = bookCounts.get(ub.bookId);
    if (existing) {
      existing.count++;
    } else {
      bookCounts.set(ub.bookId, { book: ub.book, count: 1 });
    }
  }

  // Step 5: Sort by count descending, take top 20
  return [...bookCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
    .map(({ book, count }) => ({ book, readerCount: count }));
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function GET(): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const recommendations = await getRecommendations(userId);

    return Response.json({ recommendations });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isMissingUserBookSchemaError(error)) {
      return Response.json({ recommendations: [] });
    }
    if (isMissingSocialSchemaError(error)) {
      return Response.json({ recommendations: [] });
    }
    console.error("[GET /api/recommendations]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
