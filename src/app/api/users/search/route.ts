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

    // Normalize query: strip accents for broader matching
    // PostgreSQL `insensitive` handles case but NOT accents,
    // so we use `unaccent`-style approach via raw filtering after a broad fetch.
    const normalizedQ = q
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    const users = await prisma.user.findMany({
      where: {
        id: { not: userId },
        name: { not: null },
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
      take: 100,
      orderBy: { name: "asc" },
    });

    // Filter in JS with accent-insensitive matching
    const results = users
      .filter((user) => {
        if (!user.name) return false;
        const normalizedName = user.name
          .normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
        return normalizedName.includes(normalizedQ);
      })
      .slice(0, 20)
      .map((user) => ({
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
