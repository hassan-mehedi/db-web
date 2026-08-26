import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasCookie = Boolean(getSessionCookie(request));
  if (pathname.startsWith("/login")) {
    return hasCookie && pathname === "/login"
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next();
  }
  if (!hasCookie) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
