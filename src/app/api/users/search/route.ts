import "server-only";

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { userId } = await requireAuth();

    const params = request.nextUrl.searchParams;
    const q = params.get("q")?.trim() ?? "";
    const limit = Math.min(Number(params.get("limit") ?? 41), 100);
    const offset = Math.max(Number(params.get("offset") ?? 0), 0);

    const normalizedQ = normalize(q);

    // When searching, fetch a broader set and filter in JS for accent-insensitive matching.
    // When browsing (empty query), use Prisma pagination directly.
    if (normalizedQ.length === 0) {
      const users = await prisma.user.findMany({
        where: {
          id: { not: userId },
          name: { not: null },
        },
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
    }

    // Search mode: fetch all non-self users, filter by normalized name
    const allUsers = await prisma.user.findMany({
      where: {
        id: { not: userId },
        name: { not: null },
      },
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
    });

    const filtered = allUsers
      .filter((u) => u.name && normalize(u.name).includes(normalizedQ))
      .slice(offset, offset + limit)
      .map((u) => ({
        id: u.id,
        name: u.name,
        image: u.image,
        bookCount: u._count.userBooks,
        isFollowing: u.followers.length > 0,
      }));

    return Response.json({ users: filtered });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/users/search]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
