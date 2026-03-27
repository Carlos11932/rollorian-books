import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/lib/types/user";

/**
 * Augments the Auth.js Session type to include `user.id` and `user.role`.
 *
 * WHY: Auth.js v5 does not include `user.id` or `user.role` in the DefaultSession type.
 * We add them via a session callback in src/lib/auth.ts and declare them here
 * so TypeScript knows they exist everywhere `session.user` is accessed.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }
}
