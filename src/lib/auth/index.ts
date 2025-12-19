/**
 * Authentication module
 *
 * Provides basic password-based authentication for admin routes.
 * Protected by ADMIN_PASSWORD env var.
 */

// Types
export type { SessionPayload, SessionType } from "./types";
export { SESSION_COOKIE_NAME, SESSION_DURATION_HOURS } from "./types";

// Session management
export { createSession, verifySession, verifyAdminPassword } from "./session";

// Admin verification for API routes
export { verifyAdminSession } from "./verify-admin";
