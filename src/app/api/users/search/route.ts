import "server-only";

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    if (q.length === 0) {
      return Response.json({ users: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        id: { not: userId },
        name: { contains: q, mode: "insensitive" },
      },
      select: {
        id: true,
        name: true,
        image: true,
        _count: {
          select: { userBooks: true },
        },
        followers: {
          where: { followerId: userId },
          select: { id: true },
        },
      },
      take: 20,
      orderBy: { name: "asc" },
    });

    const results = users.map((user) => ({
      id: user.id,
      name: user.name,
      image: user.image,
      bookCount: user._count.userBooks,
      isFollowing: user.followers.length > 0,
    }));

    return Response.json({ users: results });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/users/search]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
