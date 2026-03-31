import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((request) => {
  if (request.auth) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "callbackUrl",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: [
    "/",
    "/((?!api(?:/|$)|login(?:/|$)|_next|favicon\\.ico|.*\\..*).+)",
  ],
};
