import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that don't require authentication
const publicRoutes = ["/login", "/api/auth"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check for session token (NextAuth JWT) — also check chunked cookies
  const token =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value ||
    request.cookies.get("authjs.session-token.0")?.value ||
    request.cookies.get("__Secure-authjs.session-token.0")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // For app routes, check workspace cookie
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/campaigns") ||
    pathname.startsWith("/contacts") ||
    pathname.startsWith("/outreach") ||
    pathname.startsWith("/domains") ||
    pathname.startsWith("/settings")
  ) {
    const workspaceId = request.cookies.get("active-workspace")?.value;
    if (!workspaceId) {
      return NextResponse.redirect(
        new URL("/select-workspace", request.url)
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files and api routes that handle their own auth
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
