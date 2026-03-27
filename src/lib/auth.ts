import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

const isE2ETestMode = process.env.E2E_TEST_MODE === "true";

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

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: isE2ETestMode ? [Google, e2eCredentialsProvider] : [Google],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async session({ session, user }) {
      // Auth.js v5 with database sessions: `user` comes from the DB via the adapter.
      // session.user.id is NOT included by default — we must add it explicitly.
      session.user.id = user.id;

      // Fetch role from DB — do NOT trust a stale cached value.
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true },
      });
      session.user.role = dbUser?.role ?? "USER";

      return session;
    },
    authorized({ auth: session }) {
      // Return true if the user has a session, false redirects to `pages.signIn`.
      return !!session;
    },
    async signIn({ user }) {
      const email = user.email;
      if (!email) return false;

      // Allow if user already exists in DB (returning user).
      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existing) return true;

      // Allow if email matches the designated superadmin.
      const superadminEmail = process.env.SUPERADMIN_EMAIL;
      if (superadminEmail && email === superadminEmail) return true;

      // Allow if a valid PENDING non-expired invitation exists.
      const invitation = await prisma.invitation.findFirst({
        where: {
          email,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });
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
        const superadminEmail = process.env.SUPERADMIN_EMAIL;

        // If this is the designated superadmin, elevate their role.
        if (superadminEmail && email === superadminEmail) {
          await prisma.user.update({
            where: { id: user.id },
            data: { role: "SUPERADMIN" },
          });
          return;
        }

        // If there's a PENDING invitation, mark it accepted.
        const invitation = await prisma.invitation.findFirst({
          where: {
            email,
            status: "PENDING",
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        });
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
