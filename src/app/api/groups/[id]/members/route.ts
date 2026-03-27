import "server-only";

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { inviteMemberSchema } from "@/lib/schemas/group";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: NextRequest,
  { params }: RouteContext
): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const { id: groupId } = await params;

    // Only group ADMIN can invite
    const callerMembership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { role: true },
    });

    if (!callerMembership) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (callerMembership.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body: unknown = await request.json();
    const result = inviteMemberSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        { error: result.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const { email } = result.data;

    // Look up the invited user by email
    const invitedUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!invitedUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const invitedUserId = invitedUser.id;

    // Check not already a member
    const existingMembership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: invitedUserId } },
    });

    if (existingMembership) {
      return Response.json({ error: "User is already a member" }, { status: 409 });
    }

    const member = await prisma.groupMember.create({
      data: {
        groupId,
        userId: invitedUserId,
        role: "MEMBER",
        status: "PENDING",
      },
    });

    return Response.json(
      { id: member.id, groupId: member.groupId, userId: member.userId, role: member.role, status: member.status },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[POST /api/groups/[id]/members]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
