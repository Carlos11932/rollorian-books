import { auth } from "@/lib/auth";

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
