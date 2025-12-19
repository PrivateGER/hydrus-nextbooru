"use server";

import { cookies } from "next/headers";
import {
  createSession,
  verifyAdminPassword,
  verifySitePassword,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_HOURS,
} from "@/lib/auth";

interface LoginResult {
  success: boolean;
  error?: string;
}

/**
 * Authenticate user with password.
 *
 * For admin login: verifies against ADMIN_PASSWORD env var.
 * For site login: tries admin password first, then site password.
 *
 * @param password - The password to verify
 * @param requireAdmin - Whether admin access is required
 * @returns Result indicating success or error message
 */
export async function login(
  password: string,
  requireAdmin: boolean = false
): Promise<LoginResult> {
  // Always check admin password first
  const isAdmin = verifyAdminPassword(password);

  if (isAdmin) {
    // Admin password grants admin session
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

  // If admin access required, don't try site password
  if (requireAdmin) {
    return { success: false, error: "Invalid password" };
  }

  // Try site password for non-admin access
  const isSitePassword = await verifySitePassword(password);

  if (isSitePassword) {
    const token = await createSession("site");
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

  return { success: false, error: "Invalid password" };
}

/**
 * Log out the current user by clearing the session cookie.
 */
export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
