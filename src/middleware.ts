import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

const isE2ETestMode = env.E2E_TEST_MODE === "true";

/**
 * Middleware for redirect-based auth guard.
 *
 * IMPORTANT: This middleware runs on the Edge Runtime, which does NOT
 * support NextAuth's auth() (requires Node.js 'crypto' module).
 *
 * The middleware checks for the session cookie as a UX-level redirect gate.
 * Real session validation happens in requireAuth() (server-side, Node.js)
 * on every API route and server component that accesses user data.
 *
 * A forged cookie bypasses the redirect but NOT data access — all endpoints
 * call requireAuth() which validates the session against the database.
 */
export default function middleware(request: NextRequest) {
  if (isE2ETestMode) {
    return NextResponse.next();
  }

  // Check for NextAuth session cookie (secure or non-secure variant)
  const token =
    request.cookies.get("__Secure-authjs.session-token")?.value ??
    request.cookies.get("authjs.session-token")?.value;

  if (token) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "callbackUrl",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/",
    "/((?!api(?:/|$)|login(?:/|$)|_next|favicon\\.ico|.*\\..*).+)",
  ],
};
