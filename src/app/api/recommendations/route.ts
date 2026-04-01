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

// ── Recommendation engine (no cache for now — debugging) ────────────────────

async function getRecommendations(userId: string): Promise<{
  recommendations: Recommendation[];
  debug: Record<string, unknown>;
}> {
  const debug: Record<string, unknown> = {};

  // Step 1: Get the current user's book IDs
  const userBookIds = await prisma.userBook.findMany({
    where: { userId },
    select: { bookId: true },
  });
  const myBookIds = new Set(userBookIds.map((ub) => ub.bookId));
  debug.myBookCount = myBookIds.size;

  if (myBookIds.size === 0) {
    debug.exitReason = "no books in library";
    return { recommendations: [], debug };
  }

  // Step 2: Find similar readers from three sources

  // 2a: Users who share 1+ books
  const sharedBookUsers = await prisma.userBook.groupBy({
    by: ["userId"],
    where: {
      bookId: { in: [...myBookIds] },
      userId: { not: userId },
    },
    _count: true,
    having: { userId: { _count: { gte: 1 } } },
  });
  debug.sharedBookUsers = sharedBookUsers.length;

  // 2b: Users the current user follows
  let followingIds: string[] = [];
  try {
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    followingIds = following.map((f) => f.followingId);
  } catch (error) {
    if (!isMissingSocialSchemaError(error)) {
      debug.followError = error instanceof Error ? error.message : String(error);
    }
  }
  debug.followingCount = followingIds.length;

  // 2c: Users in the same groups (accepted members only)
  let groupMemberIds: string[] = [];
  try {
    const myGroups = await prisma.groupMember.findMany({
      where: { userId, status: "ACCEPTED" },
      select: { groupId: true },
    });
    debug.myGroupCount = myGroups.length;

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
    if (!isMissingSocialSchemaError(error)) {
      debug.groupError = error instanceof Error ? error.message : String(error);
    }
  }
  debug.groupMemberCount = groupMemberIds.length;

  // Combine all similar reader IDs
  const similarReaderIds = new Set([
    ...sharedBookUsers.map((u) => u.userId),
    ...followingIds,
    ...groupMemberIds,
  ]);
  debug.similarReaderCount = similarReaderIds.size;

  if (similarReaderIds.size === 0) {
    debug.exitReason = "no similar readers found";
    return { recommendations: [], debug };
  }

  // Privacy check
  const allowedReaderIds = (
    await Promise.all(
      [...similarReaderIds].map(async (readerId) => (
        await canViewUserBooks(userId, readerId) ? readerId : null
      )),
    )
  ).filter((readerId): readerId is string => readerId !== null);
  debug.allowedReaderCount = allowedReaderIds.length;

  if (allowedReaderIds.length === 0) {
    debug.exitReason = "all readers blocked by privacy";
    return { recommendations: [], debug };
  }

  // Step 3: Get candidate books
  const myBookIdArray = [...myBookIds];
  const candidateBooks = await prisma.userBook.findMany({
    where: {
      userId: { in: allowedReaderIds },
      status: { in: ["READ", "READING", "REREADING"] },
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
  debug.candidateBookCount = candidateBooks.length;

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

  const recommendations = [...bookCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
    .map(({ book, count }) => ({ book, readerCount: count }));

  debug.finalCount = recommendations.length;
  return { recommendations, debug };
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function GET(): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const result = await getRecommendations(userId);

    return Response.json(result);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[GET /api/recommendations]", error);
    return Response.json({
      recommendations: [],
      debug: { error: message },
    });
  }
}
