import "server-only";

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateMemberStatusSchema } from "@/lib/schemas/group";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";

type RouteContext = {
  params: Promise<{ id: string; userId: string }>;
};

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
): Promise<Response> {
  try {
    const { userId: callerId } = await requireAuth();
    const { id: groupId, userId: targetUserId } = await params;

    // Only the invited user can accept/reject their own invitation
    if (callerId !== targetUserId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });

    if (!membership) {
      return Response.json({ error: "Membership not found" }, { status: 404 });
    }

    if (membership.status !== "PENDING") {
      return Response.json(
        { error: "Cannot update a non-pending invitation" },
        { status: 422 }
      );
    }

    const body: unknown = await request.json();
    const result = updateMemberStatusSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        { error: result.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const updated = await prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId: targetUserId } },
      data: { status: result.data.status },
    });

    return Response.json({
      id: updated.id,
      groupId: updated.groupId,
      userId: updated.userId,
      role: updated.role,
      status: updated.status,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[PATCH /api/groups/[id]/members/[userId]]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
): Promise<Response> {
  try {
    const { userId: callerId } = await requireAuth();
    const { id: groupId, userId: targetUserId } = await params;

    const callerMembership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: callerId } },
      select: { role: true },
    });

    if (!callerMembership) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const isSelf = callerId === targetUserId;
    const isAdmin = callerMembership.role === "ADMIN";

    // Non-admins can only remove themselves
    if (!isSelf && !isAdmin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const targetMembership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });

    if (!targetMembership) {
      return Response.json({ error: "Membership not found" }, { status: 404 });
    }

    // Prevent sole admin from leaving
    if (targetMembership.role === "ADMIN") {
      const adminCount = await prisma.groupMember.count({
        where: {
          groupId,
          role: "ADMIN",
          status: "ACCEPTED",
        },
      });

      if (adminCount <= 1) {
        return Response.json(
          { error: "Cannot remove the sole admin of a group" },
          { status: 422 }
        );
      }
    }

    await prisma.groupMember.delete({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[DELETE /api/groups/[id]/members/[userId]]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
