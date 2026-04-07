import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import {
  isMissingSocialSchemaError,
  isMissingUserRoleError,
} from "@/lib/prisma-schema-compat";

const isE2ETestMode = env.E2E_TEST_MODE === "true";
// VERCEL_ENV is set by Vercel infrastructure: "production" | "preview" | "development".
// Do NOT add NODE_ENV guard — Vercel sets NODE_ENV=production on ALL deploys including preview.
const isPreviewEnv = env.VERCEL_ENV === "preview";

// CredentialsProvider is only added in E2E test mode.
// It allows Playwright tests to authenticate without requiring Google OAuth.
// NEVER enable this in production — it bypasses real authentication.
const e2eCredentialsProvider = Credentials({
  id: "e2e-test",
  name: "E2E Test",
  credentials: {
    email: { label: "Email", type: "text" },
  },
  async authorize(credentials) {
    if (!isE2ETestMode) return null;
    const email = credentials?.email as string | undefined;
    if (!email) return null;
    // Find or create the user in the database for E2E sessions
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, name: email.split("@")[0] ?? email },
      update: {},
    });
    return { id: user.id, email: user.email, name: user.name };
  },
});

// Preview auth — allows signing in by email on Vercel preview deployments.
// Unlike E2E, this does NOT create users — you must already exist in the DB.
// Additionally restricted to PREVIEW_ALLOWED_EMAILS (comma-separated allowlist)
// to prevent impersonation on publicly accessible preview URLs.
const previewCredentialsProvider = Credentials({
  id: "preview",
  name: "Preview Login",
  credentials: {
    email: { label: "Email", type: "email" },
  },
  async authorize(credentials) {
    if (!isPreviewEnv) return null;
    const email = credentials?.email as string | undefined;
    if (!email) return null;

    // Enforce allowlist if configured — reject unknown emails
    const allowlist = env.PREVIEW_ALLOWED_EMAILS;
    if (allowlist) {
      const allowed = allowlist.split(",").map((e) => e.trim().toLowerCase());
      if (!allowed.includes(email.toLowerCase())) return null;
    }

    // Only allow existing users — no account creation in previews
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });
    if (!user) return null;
    return { id: user.id, email: user.email, name: user.name };
  },
});

function getProviders() {
  if (isE2ETestMode) return [Google, e2eCredentialsProvider];
  if (isPreviewEnv) return [Google, previewCredentialsProvider];
  return [Google];
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: getProviders(),
  trustHost: true,
  session: (isE2ETestMode || isPreviewEnv) ? { strategy: "jwt" } : undefined,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async session({ session, user, token }) {
      // Database sessions: user comes from adapter (OAuth flow).
      // JWT sessions (CredentialsProvider): user is undefined, use token.sub instead.
      const userId = user?.id ?? token?.sub;
      if (!userId) return session;

      session.user.id = userId;

      // Fetch role from DB — do NOT trust a stale cached value.
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });
        session.user.role = dbUser?.role ?? "USER";
      } catch (error) {
        if (!isMissingUserRoleError(error)) {
          throw error;
        }

        session.user.role = "USER";
      }

      return session;
    },
    authorized({ auth: session }) {
      // Return true if the user has a session, false redirects to `pages.signIn`.
      return !!session;
    },
    async signIn({ user }) {
      // NOTE: This callback is NOT invoked for CredentialsProvider (Auth.js v5).
      // For credentials, the authorize() function is the sole authentication gate.
      // This callback only runs for OAuth providers (Google).
      const email = user.email;
      if (!email) return false;

      // Allow if user already exists in DB (returning user).
      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existing) return true;

      // Allow if email matches the designated superadmin.
      const superadminEmail = env.SUPERADMIN_EMAIL;
      if (superadminEmail && email === superadminEmail) return true;

      // Allow if a valid PENDING non-expired invitation exists.
      let invitation = null;
      try {
        invitation = await prisma.invitation.findFirst({
          where: {
            email,
            status: "PENDING",
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        });
      } catch (error) {
        if (!isMissingSocialSchemaError(error)) {
          throw error;
        }
      }

      if (invitation) return true;

      // No valid path to sign in — redirect with error.
      return "/login?error=not-invited";
    },
  },
  events: {
    async createUser({ user }) {
      const email = user.email;
      if (!email) return;

      try {
        const superadminEmail = env.SUPERADMIN_EMAIL;

        // If this is the designated superadmin, elevate their role.
        if (superadminEmail && email === superadminEmail) {
          await prisma.user.update({
            where: { id: user.id },
            data: { role: "SUPERADMIN" },
          });
          return;
        }

        // If there's a PENDING invitation, mark it accepted.
        let invitation = null;
        try {
          invitation = await prisma.invitation.findFirst({
            where: {
              email,
              status: "PENDING",
              expiresAt: { gt: new Date() },
            },
            select: { id: true },
          });
        } catch (error) {
          if (!isMissingSocialSchemaError(error)) {
            throw error;
          }
        }

        if (invitation) {
          await prisma.invitation.update({
            where: { id: invitation.id },
            data: { status: "ACCEPTED" },
          });
        }
      } catch {
        // Errors must NOT break signup — log only.
        console.error("[auth] createUser event failed for:", email);
      }
    },
  },
});
