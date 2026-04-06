import { auth } from "@/lib/auth";

const isE2ETestMode = process.env.E2E_TEST_MODE === "true";

/**
 * Middleware using NextAuth's `auth()` wrapper.
 * Validates the session properly (JWT verification for preview/E2E,
 * database session for production) instead of just checking cookie existence.
 */
export default auth((req) => {
  if (isE2ETestMode) return;

  // `req.auth` is the validated session — null if not authenticated
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set(
      "callbackUrl",
      `${req.nextUrl.pathname}${req.nextUrl.search}`,
    );
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: [
    "/",
    "/((?!api(?:/|$)|login(?:/|$)|_next|favicon\\.ico|.*\\..*).+)",
  ],
};
