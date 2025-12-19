/**
 * Admin session verification for API routes.
 *
 * Provides defense-in-depth by verifying admin sessions independently
 * of middleware. Each admin API handler should call this at the start.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "./session";
import { SESSION_COOKIE_NAME } from "./types";
import { apiLog } from "@/lib/logger";

export interface AdminVerifyResult {
  /** Whether the request is authorized */
  authorized: boolean;
  /** Error response to return if not authorized */
  response?: NextResponse;
}

/**
 * Verify that the request has a valid admin session.
 *
 * @returns Object with `authorized` boolean and optional `response` to return
 *
 * @example
 * ```ts
 * export async function GET() {
 *   const auth = await verifyAdminSession();
 *   if (!auth.authorized) return auth.response;
 *   // ... handle request
 * }
 * ```
 */
export async function verifyAdminSession(): Promise<AdminVerifyResult> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    if (!sessionCookie) {
      apiLog.warn({}, "Admin API access denied: no session cookie");
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        ),
      };
    }

    const session = await verifySession(sessionCookie.value);

    if (!session) {
      apiLog.warn({}, "Admin API access denied: invalid session");
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        ),
      };
    }

    if (session.type !== "admin") {
      apiLog.warn(
        { sessionType: session.type },
        "Admin API access denied: insufficient permissions"
      );
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Forbidden" },
          { status: 403 }
        ),
      };
    }

    return { authorized: true };
  } catch (error) {
    apiLog.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Admin session verification failed"
    );
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }
}
