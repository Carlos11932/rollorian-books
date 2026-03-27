import "server-only";

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(
  _request: NextRequest,
  { params }: Params
): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const { id: targetUserId } = await params;

    // 422 if trying to follow yourself
    if (userId === targetUserId) {
      return Response.json(
        { error: "Cannot follow yourself" },
        { status: 422 }
      );
    }

    // Check target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!targetUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // 409 if already following
    const existing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: userId,
          followingId: targetUserId,
        },
      },
    });
    if (existing) {
      return Response.json({ error: "Already following" }, { status: 409 });
    }

    const follow = await prisma.follow.create({
      data: {
        followerId: userId,
        followingId: targetUserId,
      },
    });

    return Response.json(follow, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[POST /api/users/[id]/follow]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: Params
): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const { id: targetUserId } = await params;

    const existing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: userId,
          followingId: targetUserId,
        },
      },
    });

    if (!existing) {
      return Response.json({ error: "Not following" }, { status: 404 });
    }

    await prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId: userId,
          followingId: targetUserId,
        },
      },
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[DELETE /api/users/[id]/follow]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
