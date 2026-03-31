import { NextResponse, type NextRequest } from "next/server";

export default function middleware(request: NextRequest) {
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
