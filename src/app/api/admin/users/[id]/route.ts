import "server-only";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, UnauthorizedError, ForbiddenError } from "@/lib/auth/require-auth";
import { logger } from "@/lib/logger";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { userId: callerId } = await requireSuperAdmin();

    const { id } = await params;

    // EC1: Prevent self-delete
    if (id === callerId) {
      return Response.json(
        { error: "You cannot delete your own account" },
        { status: 422 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!targetUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // EC9: Prevent deletion if user is the sole ADMIN of any group
    const adminMemberships = await prisma.groupMember.findMany({
      where: { userId: id, role: "ADMIN", status: "ACCEPTED" },
      select: { groupId: true, group: { select: { name: true } } },
    });

    if (adminMemberships.length > 0) {
      const groupIds = adminMemberships.map((m) => m.groupId);

      // Count other admins per group in a single query
      const otherAdminCounts = await prisma.groupMember.groupBy({
        by: ["groupId"],
        where: {
          groupId: { in: groupIds },
          role: "ADMIN",
          status: "ACCEPTED",
          userId: { not: id },
        },
        _count: { userId: true },
      });

      const groupsWithOtherAdmins = new Set(otherAdminCounts.map((r) => r.groupId));
      const soleAdminGroups = adminMemberships
        .filter((m) => !groupsWithOtherAdmins.has(m.groupId))
        .map((m) => m.group.name);

      if (soleAdminGroups.length > 0) {
        return Response.json(
          {
            error: `Cannot delete user: they are the sole admin of the following group(s): ${soleAdminGroups.join(", ")}. Promote another member to admin first.`,
          },
          { status: 422 }
        );
      }
    }

    // Cascade is handled by Prisma schema (onDelete: Cascade on UserBook, Account, Session)
    await prisma.user.delete({ where: { id } });

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    logger.error("Request failed", error, { endpoint: "DELETE /api/admin/users/[id]" });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
