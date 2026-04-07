import "server-only";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, UnauthorizedError, ForbiddenError } from "@/lib/auth/require-auth";
import { logger } from "@/lib/logger";

export async function GET(): Promise<Response> {
  try {
    await requireSuperAdmin();

    const users = await prisma.user.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        _count: {
          select: { userBooks: true },
        },
      },
    });

    const usersWithStats = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      role: u.role,
      bookCount: u._count.userBooks,
    }));

    return Response.json({ users: usersWithStats });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    logger.error("Request failed", error, { endpoint: "GET /api/admin/users" });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
