import { NextResponse, type NextRequest } from "next/server";

const isE2ETestMode = process.env.E2E_TEST_MODE === "true";

export default function middleware(request: NextRequest) {
  if (isE2ETestMode) {
    return NextResponse.next();
  }

  const token = request.cookies.get("authjs.session-token")?.value
    || request.cookies.get("__Secure-authjs.session-token")?.value;

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
