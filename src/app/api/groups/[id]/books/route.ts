import "server-only";

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";
import { logger } from "@/lib/logger";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  { params }: RouteContext
): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const { id: groupId } = await params;

    // Caller must be an ACCEPTED member
    const callerMembership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { status: true },
    });

    if (!callerMembership || callerMembership.status !== "ACCEPTED") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Optional read filter: "all" (default) | "read" | "unread"
    const readFilter = request.nextUrl.searchParams.get("readFilter") ?? "all";

    // Get all ACCEPTED member userIds in this group
    const acceptedMembers = await prisma.groupMember.findMany({
      where: { groupId, status: "ACCEPTED" },
      select: { userId: true },
    });

    const memberUserIds = acceptedMembers.map((m: { userId: string }) => m.userId);

    if (memberUserIds.length === 0) {
      return Response.json({ books: [] });
    }

    // Fetch ALL unique books owned by any group member, with genres
    const books = await prisma.book.findMany({
      where: {
        userBooks: { some: { userId: { in: memberUserIds } } },
      },
      select: {
        id: true,
        title: true,
        authors: true,
        coverUrl: true,
        genres: true,
        userBooks: {
          where: { userId },
          select: { status: true },
          take: 1,
        },
      },
      orderBy: { title: "asc" },
    });

    // Map to response shape: flat book + currentUserStatus
    const mapped = books
      .map((b) => {
        const myEntry = b.userBooks[0] ?? null;
        const currentUserStatus = myEntry?.status ?? null;
        const isRead = currentUserStatus === "READ";

        return {
          id: b.id,
          title: b.title,
          authors: b.authors,
          coverUrl: b.coverUrl,
          genres: b.genres,
          currentUserStatus,
          isRead,
        };
      })
      .filter((b) => {
        if (readFilter === "read") return b.isRead;
        if (readFilter === "unread") return !b.isRead;
        return true;
      });

    return Response.json({ books: mapped });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Request failed", error, { endpoint: "GET /api/groups/[id]/books" });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
