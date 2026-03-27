import "server-only";

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateGroupSchema } from "@/lib/schemas/group";
import { requireAuth, UnauthorizedError, ForbiddenError } from "@/lib/auth/require-auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const { id: groupId } = await params;

    // Verify caller is a member
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { id: true },
    });

    if (!membership) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        createdBy: { select: { id: true, name: true } },
        members: {
          include: { user: { select: { id: true, name: true, image: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!group) {
      return Response.json({ error: "Group not found" }, { status: 404 });
    }

    return Response.json({
      id: group.id,
      name: group.name,
      createdAt: group.createdAt,
      createdBy: group.createdBy,
      members: group.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        image: m.user.image,
        role: m.role,
        status: m.status,
      })),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/groups/[id]]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const { id: groupId } = await params;

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { role: true },
    });

    if (!membership) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (membership.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body: unknown = await request.json();
    const result = updateGroupSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        { error: result.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const group = await prisma.group.update({
      where: { id: groupId },
      data: { name: result.data.name },
    });

    return Response.json({ id: group.id, name: group.name, updatedAt: group.updatedAt });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[PATCH /api/groups/[id]]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const { id: groupId } = await params;

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { role: true },
    });

    if (!membership) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (membership.role !== "ADMIN") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.group.delete({ where: { id: groupId } });

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[DELETE /api/groups/[id]]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
