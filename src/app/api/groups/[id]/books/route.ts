import "server-only";

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, UnauthorizedError } from "@/lib/auth/require-auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

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

    // Pagination params
    const searchParams = request.nextUrl.searchParams;
    const cursor = searchParams.get("cursor");
    const limitParam = searchParams.get("limit");
    const limit = Math.min(
      parseInt(limitParam ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
      MAX_LIMIT
    );

    // Get all ACCEPTED member userIds in this group
    const acceptedMembers = await prisma.groupMember.findMany({
      where: { groupId, status: "ACCEPTED" },
      select: { userId: true },
    });

    const memberUserIds = acceptedMembers.map((m) => m.userId);

    // Handle empty group edge case (EC6)
    if (memberUserIds.length === 0) {
      return Response.json({ books: [], nextCursor: null });
    }

    // Fetch all UserBooks from group members (excluding notes — NF5)
    // We query Books with pagination, then attach member ratings
    const books = await prisma.book.findMany({
      where: {
        userBooks: {
          some: { userId: { in: memberUserIds } },
        },
      },
      include: {
        userBooks: {
          where: { userId: { in: memberUserIds } },
          select: {
            userId: true,
            status: true,
            rating: true,
            // notes intentionally excluded (owner-only per NF5)
            user: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
    });

    let nextCursor: string | null = null;
    if (books.length > limit) {
      const nextItem = books.pop();
      nextCursor = nextItem?.id ?? null;
    }

    const result = books.map((book) => ({
      book: {
        id: book.id,
        title: book.title,
        subtitle: book.subtitle,
        authors: book.authors,
        description: book.description,
        coverUrl: book.coverUrl,
        publisher: book.publisher,
        publishedDate: book.publishedDate,
        pageCount: book.pageCount,
        isbn10: book.isbn10,
        isbn13: book.isbn13,
        genres: book.genres,
        createdAt: book.createdAt,
        updatedAt: book.updatedAt,
      },
      memberRatings: book.userBooks.map((ub) => ({
        userId: ub.userId,
        userName: ub.user.name,
        rating: ub.rating,
        status: ub.status,
      })),
    }));

    return Response.json({ books: result, nextCursor });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/groups/[id]/books]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
