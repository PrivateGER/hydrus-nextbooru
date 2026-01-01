import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME } from "@/lib/auth/types";

/**
 * Middleware for admin authentication.
 *
 * Protects /admin/* and /api/admin/* routes, requiring admin session.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Only protect admin routes (exact match or with trailing path)
  const isAdminRoute =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/");

  if (!isAdminRoute) {
    return NextResponse.next();
  }

  // Get and verify session
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  const session = sessionCookie
    ? await verifySession(sessionCookie.value)
    : null;

  if (!session || session.type !== "admin") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match admin paths only
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
