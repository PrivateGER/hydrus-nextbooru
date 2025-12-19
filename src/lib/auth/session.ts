/**
 * Session management with signed cookies
 *
 * Uses HMAC-SHA256 via Web Crypto API for Edge Runtime compatibility.
 * Changing ADMIN_PASSWORD invalidates all existing sessions.
 */

import {
  type SessionPayload,
  type SessionType,
  SESSION_DURATION_HOURS,
} from "./types";

/** Maximum token payload size (prevents DoS via huge tokens) */
const MAX_PAYLOAD_SIZE = 1024;

/** Cached crypto key for HMAC operations */
let cachedKey: CryptoKey | null = null;
let cachedSecret: string | null = null;

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
 * Get or create the HMAC crypto key
 */
async function getKey(): Promise<CryptoKey> {
  const secret = getSecret();

  // Return cached key if secret hasn't changed
  if (cachedKey && cachedSecret === secret) {
    return cachedKey;
  }

  const encoder = new TextEncoder();
  cachedKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  cachedSecret = secret;

  return cachedKey;
}

/**
 * Convert ArrayBuffer to base64url string
 */
function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Generate cryptographically random bytes as base64url
 */
function generateRandomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bufferToBase64url(bytes.buffer);
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Sign a payload using HMAC-SHA256
 */
async function sign(payload: string): Promise<string> {
  const key = await getKey();
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );
  return bufferToBase64url(signature);
}

/**
 * Verify a signature using constant-time comparison
 */
async function verifySignature(
  payload: string,
  signature: string
): Promise<boolean> {
  const expected = await sign(payload);
  return timingSafeEqual(expected, signature);
}

/**
 * Create a signed session token
 *
 * @param type - The session type (admin or site)
 * @returns A signed session token string
 */
export async function createSession(type: SessionType): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    type,
    iat: now,
    exp: now + SESSION_DURATION_HOURS * 60 * 60,
    jti: generateRandomId(),
  };

  const payloadStr = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const signature = await sign(payloadStr);

  return `${payloadStr}.${signature}`;
}

/**
 * Verify and decode a session token
 *
 * @param token - The session token to verify
 * @returns The decoded payload if valid, null if invalid or expired
 */
export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
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
  if (!(await verifySignature(payloadStr, signature))) {
    return null;
  }

  // Decode payload
  let payload: SessionPayload;
  try {
    const base64 = payloadStr.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const decoded = atob(base64 + padding);
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

  return timingSafeEqual(password, adminPassword);
}
