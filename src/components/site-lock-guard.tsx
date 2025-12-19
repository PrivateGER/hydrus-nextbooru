import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthSettings, verifySession, SESSION_COOKIE_NAME } from "@/lib/auth";

interface SiteLockGuardProps {
  children: React.ReactNode;
}

/**
 * Server component that enforces site-wide password protection.
 *
 * When site lock is enabled, redirects unauthenticated users to login.
 * Admin sessions always bypass site lock.
 */
export async function SiteLockGuard({ children }: SiteLockGuardProps) {
  // Get current pathname from middleware-set header
  const headersList = await headers();
  const rawPathname = headersList.get("x-pathname") || "/";

  // Validate pathname for defense in depth (prevent redirect manipulation)
  const pathname = rawPathname.startsWith("/") && !rawPathname.startsWith("//") && !rawPathname.includes(":")
    ? rawPathname
    : "/";

  // Skip check for login page
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // Skip check for admin routes (handled by middleware)
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    return <>{children}</>;
  }

  const authSettings = await getAuthSettings();

  // If site lock is not enabled, allow access
  if (!authSettings.siteLockEnabled) {
    return <>{children}</>;
  }

  // Check for valid session
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  const session = sessionCookie ? await verifySession(sessionCookie.value) : null;

  // Admin session always passes
  if (session?.type === "admin") {
    return <>{children}</>;
  }

  // Site session passes
  if (session?.type === "site") {
    return <>{children}</>;
  }

  // No valid session - redirect to login
  const loginUrl = `/login?returnTo=${encodeURIComponent(pathname)}&type=site`;
  redirect(loginUrl);
}
