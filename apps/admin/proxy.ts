import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { legacyRedirect } from "@/lib/routes";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasCookie = Boolean(getSessionCookie(request));
  if (pathname.startsWith("/login")) {
    return hasCookie && pathname === "/login"
      ? NextResponse.redirect(new URL("/projects", request.url))
      : NextResponse.next();
  }
  if (!hasCookie) return NextResponse.redirect(new URL("/login", request.url));
  const legacy = legacyRedirect(pathname);
  if (legacy) return NextResponse.redirect(new URL(legacy + request.nextUrl.search, request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|api/health|_next/static|_next/image|favicon.ico).*)"],
};
