/**
 * Session management with signed cookies
 *
 * Uses HMAC-SHA256 to sign session payloads, with ADMIN_PASSWORD as the secret.
 * Changing ADMIN_PASSWORD invalidates all existing sessions.
 */

import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import {
  type SessionPayload,
  type SessionType,
  SESSION_DURATION_HOURS,
} from "./types";

/**
 * Get the signing secret from environment
 * @throws Error if ADMIN_PASSWORD is not set
 */
function getSecret(): string {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error("ADMIN_PASSWORD environment variable is not set");
  }
  return secret;
}

/**
 * Sign a payload using HMAC-SHA256
 */
function sign(payload: string): string {
  const hmac = createHmac("sha256", getSecret());
  hmac.update(payload);
  return hmac.digest("base64url");
}

/**
 * Verify a signature using constant-time comparison
 */
function verifySignature(payload: string, signature: string): boolean {
  const expected = sign(payload);
  if (expected.length !== signature.length) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/** Maximum token payload size (prevents DoS via huge tokens) */
const MAX_PAYLOAD_SIZE = 1024;

/**
 * Create a signed session token
 *
 * @param type - The session type (admin or site)
 * @returns A signed session token string
 */
export function createSession(type: SessionType): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    type,
    iat: now,
    exp: now + SESSION_DURATION_HOURS * 60 * 60,
    jti: randomBytes(16).toString("base64url"), // Unique token ID prevents prediction
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(payloadStr);

  return `${payloadStr}.${signature}`;
}

/**
 * Verify and decode a session token
 *
 * @param token - The session token to verify
 * @returns The decoded payload if valid, null if invalid or expired
 */
export function verifySession(token: string): SessionPayload | null {
  if (!token || typeof token !== "string") {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [payloadStr, signature] = parts;

  // Prevent DoS via huge payloads
  if (payloadStr.length > MAX_PAYLOAD_SIZE) {
    return null;
  }

  // Verify signature
  if (!verifySignature(payloadStr, signature)) {
    return null;
  }

  // Decode payload
  let payload: SessionPayload;
  try {
    const decoded = Buffer.from(payloadStr, "base64url").toString("utf-8");
    payload = JSON.parse(decoded) as SessionPayload;
  } catch {
    return null;
  }

  // Validate payload structure
  if (
    !payload ||
    typeof payload.type !== "string" ||
    typeof payload.iat !== "number" ||
    typeof payload.exp !== "number" ||
    typeof payload.jti !== "string"
  ) {
    return null;
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    return null;
  }

  // Validate session type
  if (payload.type !== "admin" && payload.type !== "site") {
    return null;
  }

  return payload;
}

/**
 * Verify the admin password against the environment variable
 *
 * @param password - The password to verify
 * @returns True if the password matches ADMIN_PASSWORD
 */
export function verifyAdminPassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return false;
  }

  // Use constant-time comparison to prevent timing attacks
  if (password.length !== adminPassword.length) {
    return false;
  }

  try {
    return timingSafeEqual(
      Buffer.from(password),
      Buffer.from(adminPassword)
    );
  } catch {
    return false;
  }
}
