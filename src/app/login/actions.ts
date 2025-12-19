"use server";

import { cookies, headers } from "next/headers";
import {
  createSession,
  verifyAdminPassword,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_HOURS,
} from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiLog } from "@/lib/logger";

/** Maximum login attempts per window */
const LOGIN_LIMIT = 5;
/** Rate limit window in milliseconds (15 minutes) */
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

interface LoginResult {
  success: boolean;
  error?: string;
}

/**
 * Extract client IP from request headers.
 * Returns null if no valid IP is found in production (fail closed).
 *
 * Set SKIP_IP_HEADER_CHECK=1 to allow direct access without reverse proxy.
 */
function getClientIP(headersList: Headers): string | null {
  const forwardedFor = headersList.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIP = headersList.get("x-real-ip");
  if (realIP) {
    return realIP.trim();
  }

  // Allow override for direct access (no reverse proxy)
  if (process.env.SKIP_IP_HEADER_CHECK === "1") {
    return "direct";
  }

  // In production, require proper IP headers from reverse proxy
  if (process.env.NODE_ENV === "production") {
    apiLog.error({}, "Missing IP headers for rate limiting - check reverse proxy configuration (X-Forward-For) or set SKIP_IP_HEADER_CHECK=1");
    return null;
  }

  // In development, allow fallback to "localhost"
  return "localhost";
}

/**
 * Authenticate user with admin password.
 * Rate limited to prevent brute force attacks.
 *
 * @param password - The password to verify
 * @returns Result indicating success or error message
 */
export async function login(password: string): Promise<LoginResult> {
  // Get client IP for rate limiting
  const headersList = await headers();
  const ip = getClientIP(headersList);

  // Fail closed if IP cannot be determined in production
  if (!ip) {
    return {
      success: false,
      error: "Service configuration error. Missing forwarded IP headers (X-Forwarded-For) or set SKIP_IP_HEADER_CHECK=1. Do not expose this service directly unless needed.",
    };
  }

  // Check rate limit
  const rateLimit = checkRateLimit(`login:${ip}`, LOGIN_LIMIT, LOGIN_WINDOW_MS);
  if (!rateLimit.allowed) {
    const minutes = Math.ceil(rateLimit.resetIn / 60000);
    return {
      success: false,
      error: `Too many login attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  const isAdmin = verifyAdminPassword(password);

  if (!isAdmin) {
    return { success: false, error: "Invalid password" };
  }

  const token = await createSession("admin");
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION_HOURS * 60 * 60,
    path: "/",
  });

  return { success: true };
}

/**
 * Log out the current user by clearing the session cookie.
 */
export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
