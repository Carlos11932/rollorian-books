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
    session({ session, user }) {
      // Auth.js v5 with database sessions: `user` comes from the DB via the adapter.
      // session.user.id is NOT included by default — we must add it explicitly.
      session.user.id = user.id;
      return session;
    },
    authorized({ auth: session }) {
      // Return true if the user has a session, false redirects to `pages.signIn`.
      return !!session;
    },
  },
});
