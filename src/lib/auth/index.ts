/**
 * Authentication module
 *
 * Provides basic password-based authentication with two levels:
 * - Admin: Protected by ADMIN_PASSWORD env var
 * - Site: Optional site-wide lock with configurable password
 */

// Types
export type { SessionPayload, SessionType, AuthSettings } from "./types";
export {
  AUTH_SETTINGS_KEYS,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_HOURS,
} from "./types";

// Session management
export { createSession, verifySession, verifyAdminPassword } from "./session";

// Auth settings
export {
  getAuthSettings,
  updateSiteLockEnabled,
  updateSitePassword,
  verifySitePassword,
  clearSitePassword,
} from "./settings";
