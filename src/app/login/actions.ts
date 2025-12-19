"use server";

import { cookies } from "next/headers";
import {
  createSession,
  verifyAdminPassword,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_HOURS,
} from "@/lib/auth";

interface LoginResult {
  success: boolean;
  error?: string;
}

/**
 * Authenticate user with admin password.
 *
 * @param password - The password to verify
 * @returns Result indicating success or error message
 */
export async function login(password: string): Promise<LoginResult> {
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
