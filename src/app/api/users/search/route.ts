import "server-only";

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { userId } = await requireAuth();

    const params = request.nextUrl.searchParams;
    const q = params.get("q")?.trim() ?? "";
    const limit = Math.min(Number(params.get("limit") ?? 41), 100);
    const offset = Math.max(Number(params.get("offset") ?? 0), 0);

    // Build where clause — use Prisma `contains` with `mode: insensitive` for DB-level filtering
    const baseWhere = {
      id: { not: userId },
      name: { not: null },
      ...(q.length > 0
        ? { name: { not: null, contains: q, mode: "insensitive" as const } }
        : {}),
    };

    const users = await prisma.user.findMany({
      where: baseWhere,
      select: {
        id: true,
        name: true,
        image: true,
        _count: { select: { userBooks: true } },
        followers: {
          where: { followerId: userId },
          select: { id: true },
        },
      },
      orderBy: { name: "asc" },
      skip: offset,
      take: limit,
    });

    return Response.json({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        image: u.image,
        bookCount: u._count.userBooks,
        isFollowing: u.followers.length > 0,
      })),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/users/search]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
