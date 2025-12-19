/**
 * Authentication type definitions and constants
 */

/** Session types for different access levels */
export type SessionType = "admin";

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

/** Name of the session cookie */
export const SESSION_COOKIE_NAME = "booru_session";

/** Session duration in hours */
export const SESSION_DURATION_HOURS = 24;
