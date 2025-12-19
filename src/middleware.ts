import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
// Import directly from session to avoid Edge Runtime issues with settings.ts (uses Node.js crypto)
import { verifySession } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME } from "@/lib/auth/types";

/**
 * Middleware for authentication.
 *
 * - Protects /admin/* and /api/admin/* routes (requires admin session)
 * - Passes pathname to server components via x-pathname header for site lock
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Create response with pathname header for site lock guard
  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);

  // Skip auth check for non-admin routes
  const isAdminRoute =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (!isAdminRoute) {
    return response;
  }

  // Get and verify session
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  const session = sessionCookie ? await verifySession(sessionCookie.value) : null;

  // Admin routes require admin session
  if (!session || session.type !== "admin") {
    // API routes return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Pages redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnTo", pathname);
    loginUrl.searchParams.set("type", "admin");
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico|api/files|api/thumbnails).*)",
  ],
};
