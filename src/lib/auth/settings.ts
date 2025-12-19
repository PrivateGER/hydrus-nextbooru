/**
 * Database-backed auth settings management
 *
 * Follows the pattern established in src/lib/openrouter/settings.ts
 */

import { scrypt, randomBytes, timingSafeEqual, ScryptOptions } from "crypto";
import { prisma } from "@/lib/db";
import { AUTH_SETTINGS_KEYS, type AuthSettings } from "./types";

/**
 * Promisified scrypt with options support
 */
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/** Salt length for password hashing */
const SALT_LENGTH = 16;

/** Key length for scrypt output */
const KEY_LENGTH = 64;

/** Scrypt parameters (OWASP recommended) */
const SCRYPT_OPTIONS = {
  N: 131072, // 2^17 - cost parameter
  r: 8, // block size
  p: 1, // parallelization
  maxmem: 256 * 1024 * 1024, // 256MB
};

/** Minimum password length */
const MIN_PASSWORD_LENGTH = 8;

/** Maximum password length */
const MAX_PASSWORD_LENGTH = 128;

/**
 * Validate password meets length requirements
 *
 * @param password - Password to validate
 * @throws Error if password doesn't meet requirements
 */
function validatePassword(password: string): void {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password must be at most ${MAX_PASSWORD_LENGTH} characters`);
  }
}

/**
 * Hash a password using scrypt with secure parameters
 *
 * @param password - Plain text password to hash
 * @returns A string in format "salt:hash" (both hex encoded)
 * @throws Error if password doesn't meet length requirements
 * @internal This function is for internal use only
 */
async function hashPassword(password: string): Promise<string> {
  validatePassword(password);
  const salt = randomBytes(SALT_LENGTH);
  const hash = await scryptAsync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

/**
 * Verify a password against a stored hash
 *
 * @param password - Plain text password to verify
 * @param storedHash - The stored hash in "salt:hash" format
 * @returns True if password matches
 * @internal This function is for internal use only
 */
async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  // Early return for invalid inputs
  if (!password || !storedHash) {
    return false;
  }

  const parts = storedHash.split(":");
  if (parts.length !== 2) {
    return false;
  }

  const [saltHex, hashHex] = parts;

  // Validate hex strings before decoding
  try {
    const salt = Buffer.from(saltHex, "hex");
    const storedKey = Buffer.from(hashHex, "hex");

    // Validate decoded lengths
    if (salt.length !== SALT_LENGTH || storedKey.length !== KEY_LENGTH) {
      return false;
    }

    const derivedKey = await scryptAsync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);

    return timingSafeEqual(derivedKey, storedKey);
  } catch {
    return false;
  }
}

/**
 * Load auth settings from the database
 *
 * @returns Current auth settings
 */
export async function getAuthSettings(): Promise<AuthSettings> {
  const settings = await prisma.settings.findMany({
    where: {
      key: {
        in: Object.values(AUTH_SETTINGS_KEYS),
      },
    },
  });

  const settingsMap = new Map(settings.map((s) => [s.key, s.value]));

  return {
    siteLockEnabled:
      settingsMap.get(AUTH_SETTINGS_KEYS.SITE_LOCK_ENABLED) === "true",
    sitePasswordHash:
      settingsMap.get(AUTH_SETTINGS_KEYS.SITE_PASSWORD_HASH) || null,
  };
}

/**
 * Update the site lock enabled setting
 *
 * @param enabled - Whether site lock should be enabled
 */
export async function updateSiteLockEnabled(enabled: boolean): Promise<void> {
  await prisma.settings.upsert({
    where: { key: AUTH_SETTINGS_KEYS.SITE_LOCK_ENABLED },
    update: { value: enabled ? "true" : "false" },
    create: { key: AUTH_SETTINGS_KEYS.SITE_LOCK_ENABLED, value: enabled ? "true" : "false" },
  });
}

/**
 * Update the site password (hashes the password before storing)
 *
 * @param password - Plain text password to hash and store
 */
export async function updateSitePassword(password: string): Promise<void> {
  const hash = await hashPassword(password);
  await prisma.settings.upsert({
    where: { key: AUTH_SETTINGS_KEYS.SITE_PASSWORD_HASH },
    update: { value: hash },
    create: { key: AUTH_SETTINGS_KEYS.SITE_PASSWORD_HASH, value: hash },
  });
}

/**
 * Verify a password against the stored site password
 *
 * @param password - Plain text password to verify
 * @returns True if password matches the stored site password
 */
export async function verifySitePassword(password: string): Promise<boolean> {
  const settings = await getAuthSettings();
  if (!settings.sitePasswordHash) {
    return false;
  }
  return verifyPassword(password, settings.sitePasswordHash);
}

/**
 * Clear the site password (for disabling site lock)
 */
export async function clearSitePassword(): Promise<void> {
  await prisma.settings.deleteMany({
    where: { key: AUTH_SETTINGS_KEYS.SITE_PASSWORD_HASH },
  });
}
