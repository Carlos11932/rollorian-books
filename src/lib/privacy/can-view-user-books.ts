import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Determines whether `viewerId` is allowed to see `targetUserId`'s books.
 *
 * Rules (evaluated in order, short-circuit on first true):
 * 1. Self — viewers always see their own books.
 * 2. Shared ACCEPTED group — both viewer and target are ACCEPTED members
 *    of at least one common group.
 * 3. Follow — viewer follows target.
 *
 * @returns `true` if the viewer has access, `false` otherwise.
 */
export async function canViewUserBooks(
  viewerId: string,
  targetUserId: string
): Promise<boolean> {
  // 1. Self — always allowed
  if (viewerId === targetUserId) return true;

  // 2. Shared ACCEPTED group membership
  const sharedGroup = await prisma.groupMember.findFirst({
    where: {
      userId: viewerId,
      status: "ACCEPTED",
      group: {
        members: {
          some: {
            userId: targetUserId,
            status: "ACCEPTED",
          },
        },
      },
    },
    select: { id: true },
  });

  if (sharedGroup) return true;

  // 3. Follow check — viewer follows target
  const follow = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId: viewerId,
        followingId: targetUserId,
      },
    },
    select: { id: true },
  });

  if (follow) return true;

  return false;
}
