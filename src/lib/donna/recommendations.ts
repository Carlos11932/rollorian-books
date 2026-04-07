import "server-only";

import { prisma } from "@/lib/prisma";
import { getViewableUserIds } from "@/lib/privacy/can-view-user-books";
import { isMissingSocialSchemaError } from "@/lib/prisma-schema-compat";
import { normalizeBook, type NormalizedBook, type BookInput } from "./normalize";
import { getDonnaUserContext } from "./user";

export async function getDonnaRecommendations() {
  const { userId } = await getDonnaUserContext();
  const userBookIds = await prisma.userBook.findMany({
    where: { userId },
    select: { bookId: true },
  });
  const myBookIds = new Set(userBookIds.map((row) => row.bookId));

  if (myBookIds.size === 0) {
    return { recommendations: [] };
  }

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
  let groupMemberIds: string[] = [];
  try {
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    followingIds = following.map((item) => item.followingId);

    const myGroups = await prisma.groupMember.findMany({
      where: { userId, status: "ACCEPTED" },
      select: { groupId: true },
    });

    if (myGroups.length > 0) {
      const groupMembers = await prisma.groupMember.findMany({
        where: {
          groupId: { in: myGroups.map((group) => group.groupId) },
          userId: { not: userId },
          status: "ACCEPTED",
        },
        select: { userId: true },
      });
      groupMemberIds = groupMembers.map((row) => row.userId);
    }
  } catch (error) {
    if (!isMissingSocialSchemaError(error)) {
      throw error;
    }
  }

  const similarReaderIds = new Set([
    ...sharedBookUsers.map((item) => item.userId),
    ...followingIds,
    ...groupMemberIds,
  ]);
  const allowedReaderIds = [...await getViewableUserIds(userId, [...similarReaderIds])];

  if (allowedReaderIds.length === 0) {
    return { recommendations: [] };
  }

  const candidateBooks = await prisma.userBook.findMany({
    where: {
      userId: { in: allowedReaderIds },
      status: { in: ["READ", "READING"] },
      bookId: { notIn: [...myBookIds] },
    },
    select: {
      bookId: true,
      book: {
        select: {
          id: true,
          title: true,
          subtitle: true,
          authors: true,
          description: true,
          coverUrl: true,
          publisher: true,
          publishedDate: true,
          pageCount: true,
          isbn10: true,
          isbn13: true,
          genres: true,
        },
      },
    },
  });

  const counts = new Map<string, { book: NormalizedBook; readerCount: number }>();
  for (const candidate of candidateBooks) {
    const existing = counts.get(candidate.bookId);
    if (existing) {
      existing.readerCount += 1;
    } else {
      counts.set(candidate.bookId, {
        book: normalizeBook(candidate.book as BookInput),
        readerCount: 1,
      });
    }
  }

  return {
    recommendations: [...counts.values()].sort((left, right) => right.readerCount - left.readerCount).slice(0, 20),
  };
}
