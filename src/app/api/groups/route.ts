import "server-only";

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createGroupSchema } from "@/lib/schemas/group";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";

export async function GET(_request: NextRequest): Promise<Response> {
  try {
    const { userId } = await requireAuth();

    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            _count: { select: { members: { where: { status: "ACCEPTED" } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const groups = memberships.map((m) => ({
      id: m.group.id,
      name: m.group.name,
      memberCount: m.group._count.members,
      userRole: m.role,
      userStatus: m.status,
      createdAt: m.group.createdAt,
    }));

    return Response.json({ groups });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/groups]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { userId } = await requireAuth();

    const body: unknown = await request.json();
    const result = createGroupSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        { error: result.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const group = await prisma.group.create({
      data: {
        name: result.data.name,
        createdById: userId,
        members: {
          create: {
            userId,
            role: "ADMIN",
            status: "ACCEPTED",
          },
        },
      },
      include: {
        _count: { select: { members: { where: { status: "ACCEPTED" } } } },
      },
    });

    return Response.json(
      {
        id: group.id,
        name: group.name,
        memberCount: group._count.members,
        createdAt: group.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[POST /api/groups]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
