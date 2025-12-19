"use server";

import { cookies, headers } from "next/headers";
import {
  createSession,
  verifyAdminPassword,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_HOURS,
} from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

/** Maximum login attempts per window */
const LOGIN_LIMIT = 5;
/** Rate limit window in milliseconds (15 minutes) */
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

interface LoginResult {
  success: boolean;
  error?: string;
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
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    "unknown";

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
