export { auth as default } from "@/lib/auth";

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *   - /login            (public sign-in page)
     *   - /api/auth/*       (Auth.js route handler)
     *   - /api/health       (health check)
     *   - /_next/*          (Next.js internals)
     *   - /favicon.ico      (static asset)
     *   - files with extensions (static assets like .png, .svg, .css, etc.)
     */
    "/((?!login|api/auth|api/health|_next|favicon\\.ico|.*\\..*).+)",
  ],
};
