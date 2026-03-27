import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/lib/types/user";

/**
 * Thrown when a request lacks a valid authenticated session.
 * Callers (route handlers) should catch this and return 401.
 */
export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Thrown when an authenticated user lacks the required role.
 * Callers (route handlers) should catch this and return 403.
 */
export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Asserts that the current request has an authenticated session.
 *
 * @returns `{ userId: string }` — the authenticated user's database ID.
 * @throws {UnauthorizedError} if there is no session or user ID.
 */
export async function requireAuth(): Promise<{ userId: string }> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }

  return { userId: session.user.id };
}

/**
 * Asserts that the current request is from an authenticated SUPERADMIN user.
 *
 * WHY: Role is fetched directly from the DB rather than trusting the session
 * to prevent privilege escalation via a stale cached session value.
 *
 * @returns `{ userId: string; role: UserRole }` — the authenticated superadmin's data.
 * @throws {UnauthorizedError} if there is no session.
 * @throws {ForbiddenError} if the user exists but is not SUPERADMIN.
 */
export async function requireSuperAdmin(): Promise<{
  userId: string;
  role: UserRole;
}> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }

  const userId = session.user.id;

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!dbUser || dbUser.role !== "SUPERADMIN") {
    throw new ForbiddenError();
  }

  return { userId, role: dbUser.role };
}
