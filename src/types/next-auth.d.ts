import type { DefaultSession } from "next-auth";

/**
 * Augments the Auth.js Session type to include `user.id`.
 *
 * WHY: Auth.js v5 does not include `user.id` in the DefaultSession type.
 * We add it via a session callback in src/lib/auth.ts and declare it here
 * so TypeScript knows it exists everywhere `session.user.id` is accessed.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
