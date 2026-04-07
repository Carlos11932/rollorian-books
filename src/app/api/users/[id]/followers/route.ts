import "server-only";

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";
import { logger } from "@/lib/logger";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: Params
): Promise<Response> {
  try {
    await requireAuth();
    const { id: targetUserId } = await params;

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!targetUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const follows = await prisma.follow.findMany({
      where: { followingId: targetUserId },
      include: {
        follower: {
          select: { id: true, name: true, image: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const users = follows.map((f) => f.follower);

    return Response.json({ users, total: users.length });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Request failed", error, { endpoint: "GET /api/users/[id]/followers" });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
