/**
 * Session management with signed cookies
 *
 * Uses HMAC-SHA256 via Web Crypto API for Edge Runtime compatibility.
 * The signing key is derived from ADMIN_PASSWORD using HKDF for proper
 * key separation and 256-bit key strength regardless of password length.
 *
 * Changing ADMIN_PASSWORD invalidates all existing sessions.
 */

import {
  type SessionPayload,
  type SessionType,
  SESSION_DURATION_HOURS,
} from "./types";
import { createLogger } from "@/lib/logger";

const authLog = createLogger("auth");

/** Maximum token payload size (prevents DoS via huge tokens) */
const MAX_PAYLOAD_SIZE = 1024;

/** Minimum password length for security */
const MIN_PASSWORD_LENGTH = 16;

/** Salt for HKDF key derivation (domain separation) */
const HKDF_SALT = "booru-session-signing-v1";

/** Info parameter for HKDF (key purpose separation) */
const HKDF_INFO = "session-hmac";

/** Cached crypto key for HMAC operations */
let cachedKey: CryptoKey | null = null;
let cachedSecretHash: string | null = null;

/** Generated password stored in memory (when auto-generated) */
let generatedPassword: string | null = null;

/**
 * Generate a cryptographically secure random password
 */
function generateRandomPassword(): string {
  const bytes = new Uint8Array(24); // 192 bits = 32 base64 chars
  crypto.getRandomValues(bytes);
  return bufferToBase64url(bytes.buffer);
}

/**
 * Hash a string for cache comparison (avoids storing plaintext password)
 */
async function hashForComparison(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bufferToBase64url(hash);
}

/**
 * Get the signing secret from environment or generate one
 * @throws Error if password is too short
 */
function getSecret(): string {
  let secret = process.env.ADMIN_PASSWORD;

  if (!secret) {
    // Generate a random password if not provided
    if (!generatedPassword) {
      generatedPassword = generateRandomPassword();
      authLog.warn(
        { password: generatedPassword },
        "ADMIN_PASSWORD not set. Generated random password (shown above). Set ADMIN_PASSWORD env var for persistence."
      );
    }
    secret = generatedPassword;
  }

  if (secret.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters (got ${secret.length})`
    );
  }

  return secret;
}

/**
 * Derive an HMAC signing key from the admin password using HKDF.
 *
 * This provides:
 * - Proper 256-bit key regardless of password length
 * - Domain separation via salt (prevents cross-application attacks)
 * - Key purpose separation via info parameter
 */
async function getKey(): Promise<CryptoKey> {
  const secret = getSecret();
  const secretHash = await hashForComparison(secret);

  // Return cached key if secret hasn't changed (compare hash, not plaintext)
  if (cachedKey && cachedSecretHash === secretHash) {
    return cachedKey;
  }

  const encoder = new TextEncoder();

  // Import password as key material for HKDF
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "HKDF",
    false,
    ["deriveKey"]
  );

  // Derive a proper 256-bit HMAC key
  cachedKey = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode(HKDF_SALT),
      info: encoder.encode(HKDF_INFO),
    },
    keyMaterial,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  cachedSecretHash = secretHash;

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
 * Convert base64url string to ArrayBuffer
 */
function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
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
 * Constant-time string comparison to prevent timing attacks.
 * Used for password verification where crypto.subtle.verify isn't available.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  let result = a.length ^ b.length; // Non-zero if lengths differ

  for (let i = 0; i < maxLen; i++) {
    const charA = i < a.length ? a.charCodeAt(i) : 0;
    const charB = i < b.length ? b.charCodeAt(i) : 0;
    result |= charA ^ charB;
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
 * Verify a signature using Web Crypto API (guaranteed constant-time)
 */
async function verifySignature(
  payload: string,
  signature: string
): Promise<boolean> {
  try {
    const key = await getKey();
    const encoder = new TextEncoder();
    const signatureBuffer = base64urlToBuffer(signature);

    return await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBuffer,
      encoder.encode(payload)
    );
  } catch {
    // Invalid base64 or other errors
    return false;
  }
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
  if (payload.type !== "admin") {
    return null;
  }

  return payload;
}

/**
 * Verify the admin password against the configured or generated password
 *
 * @param password - The password to verify
 * @returns True if the password matches ADMIN_PASSWORD or the generated password
 */
export function verifyAdminPassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD ?? generatedPassword;
  if (!adminPassword) {
    return false;
  }

  return timingSafeEqual(password, adminPassword);
}
