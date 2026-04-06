import "server-only";

import { prisma } from "@/lib/prisma";
import { isMissingSocialSchemaError } from "@/lib/prisma-schema-compat";

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
  targetUserId: string,
): Promise<boolean> {
  if (viewerId === targetUserId) return true;

  const allowed = await getViewableUserIds(viewerId, [targetUserId]);
  return allowed.has(targetUserId);
}

/**
 * Bulk resolver — resolves visibility for MANY target user IDs in 2 queries
 * instead of N+1. Returns the subset of `targetUserIds` that `viewerId`
 * is allowed to see.
 *
 * Used by recommendations and book detail to avoid per-reader DB calls.
 */
export async function getViewableUserIds(
  viewerId: string,
  targetUserIds: string[],
): Promise<Set<string>> {
  const allowed = new Set<string>();

  // 1. Self is always allowed
  if (targetUserIds.includes(viewerId)) {
    allowed.add(viewerId);
  }

  const othersToCheck = targetUserIds.filter((id) => id !== viewerId);
  if (othersToCheck.length === 0) return allowed;

  // 2. Shared ACCEPTED group — single query for ALL targets
  try {
    const viewerGroups = await prisma.groupMember.findMany({
      where: { userId: viewerId, status: "ACCEPTED" },
      select: { groupId: true },
    });

    if (viewerGroups.length > 0) {
      const sharedMembers = await prisma.groupMember.findMany({
        where: {
          groupId: { in: viewerGroups.map((g) => g.groupId) },
          userId: { in: othersToCheck },
          status: "ACCEPTED",
        },
        select: { userId: true },
      });

      for (const m of sharedMembers) {
        allowed.add(m.userId);
      }
    }
  } catch (error) {
    if (!isMissingSocialSchemaError(error)) throw error;
  }

  // 3. Follow check — single query for ALL remaining targets
  const stillNeeded = othersToCheck.filter((id) => !allowed.has(id));

  if (stillNeeded.length > 0) {
    try {
      const follows = await prisma.follow.findMany({
        where: {
          followerId: viewerId,
          followingId: { in: stillNeeded },
        },
        select: { followingId: true },
      });

      for (const f of follows) {
        allowed.add(f.followingId);
      }
    } catch (error) {
      if (!isMissingSocialSchemaError(error)) throw error;
    }
  }

  return allowed;
}
