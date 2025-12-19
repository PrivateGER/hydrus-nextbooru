/**
 * Authentication type definitions and constants
 */

/** Session types for different access levels */
export type SessionType = "admin" | "site";

/** Payload stored in the signed session cookie */
export interface SessionPayload {
  /** Access level granted by this session */
  type: SessionType;
  /** Issued at timestamp (Unix seconds) */
  iat: number;
  /** Expiration timestamp (Unix seconds) */
  exp: number;
  /** Unique token identifier (prevents token prediction) */
  jti: string;
}

/** Auth settings stored in the database */
export interface AuthSettings {
  /** Whether site-wide password protection is enabled */
  siteLockEnabled: boolean;
  /** Scrypt hash of the site password (null if not set) */
  sitePasswordHash: string | null;
}

/** Database settings keys for auth configuration */
export const AUTH_SETTINGS_KEYS = {
  SITE_LOCK_ENABLED: "auth.siteLockEnabled",
  SITE_PASSWORD_HASH: "auth.sitePasswordHash",
} as const;

/** Name of the session cookie */
export const SESSION_COOKIE_NAME = "booru_session";

/** Session duration in hours */
export const SESSION_DURATION_HOURS = 24;
