/**
 * Manually-defined User model that mirrors the Prisma schema.
 *
 * WHY: Prisma 7 with driver adapters does NOT reliably export model types
 * (like `User`) from `@prisma/client` on every platform.
 * These types MUST stay in sync with `prisma/schema.prisma`.
 */

export interface User {
  id: string;
  name: string | null;
  email: string;
  emailVerified: Date | null;
  image: string | null;
}
