import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isMissingUserRoleError } from "@/lib/prisma-schema-compat";
import type { UserRole } from "@/lib/types/user";

const E2E_TEST_USER = {
  EMAIL: "carlos@rollorian.dev",
} as const;

const isE2ETestMode = process.env.E2E_TEST_MODE === "true";

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

export async function getAuthenticatedUserIdOrNull(): Promise<string | null> {
  const session = await auth();

  if (session?.user?.id) {
    return session.user.id;
  }

  if (!isE2ETestMode) {
    return null;
  }

  const e2eUser = await prisma.user.findUnique({
    where: { email: E2E_TEST_USER.EMAIL },
    select: { id: true },
  });

  return e2eUser?.id ?? null;
}

/**
 * Asserts that the current request has an authenticated session.
 *
 * @returns `{ userId: string }` — the authenticated user's database ID.
 * @throws {UnauthorizedError} if there is no session or user ID.
 */
export async function requireAuth(): Promise<{ userId: string }> {
  const userId = await getAuthenticatedUserIdOrNull();

  if (!userId) {
    throw new UnauthorizedError();
  }

  return { userId };
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

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!dbUser || dbUser.role !== "SUPERADMIN") {
      throw new ForbiddenError();
    }

    return { userId, role: dbUser.role };
  } catch (error) {
    if (!isMissingUserRoleError(error)) {
      throw error;
    }

    if (session.user.email && process.env.SUPERADMIN_EMAIL === session.user.email) {
      return { userId, role: "SUPERADMIN" };
    }

    throw new ForbiddenError();
  }
}
