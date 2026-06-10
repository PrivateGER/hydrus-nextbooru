import { NextRequest, NextResponse } from "next/server";
import { isIP } from "net";

/**
 * Simple in-memory rate limiter.
 * Sliding window with lazy cleanup.
 *
 * SINGLE-PROCESS ONLY: the `store` Map below lives in this process's memory, so
 * limits are PER-PROCESS and are NOT shared across multiple workers/replicas.
 * The app assumes a single Next.js process. See the "Deployment / Concurrency"
 * section in CLAUDE.md before deploying multi-worker/multi-replica.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/** Cleanup expired entries every 5 minutes */
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

/**
 * Remove expired entries from the store (lazy cleanup)
 */
function cleanup(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining attempts in the current window */
  remaining: number;
  /** Milliseconds until the window resets */
  resetIn: number;
}

/**
 * Check if a request is allowed under the rate limit.
 *
 * @param key - Unique identifier (e.g., "login:192.168.1.1")
 * @param limit - Maximum requests allowed in the window
 * @param windowMs - Window duration in milliseconds
 * @returns Rate limit status
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  cleanup();

  const now = Date.now();
  const entry = store.get(key);

  // New window or expired entry
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetIn: windowMs };
  }

  // Rate limit exceeded
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetIn: entry.resetAt - now };
  }

  // Increment counter
  entry.count++;
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetIn: entry.resetAt - now,
  };
}

interface HeaderReader {
  get(name: string): string | null;
}

/**
 * Return a canonical IP value when the header contains a valid IPv4/IPv6
 * literal. Invalid or empty header values are ignored instead of becoming
 * attacker-controlled rate-limit keys.
 */
function normalizeHeaderIp(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const withoutIpv6Brackets = trimmed.startsWith("[") && trimmed.endsWith("]")
    ? trimmed.slice(1, -1)
    : trimmed;

  return isIP(withoutIpv6Brackets) ? withoutIpv6Brackets : null;
}

/**
 * Extract client IP from request headers.
 *
 * Trust model: deployments that put the app behind a reverse proxy must ensure
 * the proxy overwrites client-supplied forwarding headers. Prefer X-Real-IP as
 * the proxy's single canonical client IP. If it is absent, use the right-most
 * valid X-Forwarded-For hop, which is less spoofable than the user-controlled
 * left-most hop when a proxy appends to XFF.
 */
export function getClientIPFromHeaders(headers: HeaderReader): string {
  const realIP = normalizeHeaderIp(headers.get("x-real-ip"));
  if (realIP) {
    return realIP;
  }

  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const forwardedIp = forwardedFor
      .split(",")
      .map((value) => normalizeHeaderIp(value))
      .filter((value): value is string => Boolean(value))
      .at(-1);

    if (forwardedIp) return forwardedIp;
  }

  // Fallback for direct connections (development)
  return "unknown";
}

/**
 * Extract client IP from a Next.js request.
 */
function getClientIP(request: NextRequest): string {
  return getClientIPFromHeaders(request.headers);
}

/** Rate limit configuration for an API endpoint */
export interface ApiRateLimitConfig {
  /** Prefix for the rate limit key (e.g., "posts-search") */
  prefix: string;
  /** Maximum requests allowed in the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

/**
 * Check rate limit for an API request and return a 429 response if exceeded.
 *
 * @param request - Next.js request object
 * @param config - Rate limit configuration
 * @returns NextResponse with 429 status if rate limited, null otherwise
 */
/**
 * Test/benchmark escape hatch: high-volume suites exceed per-IP budgets by
 * design, and a 429 short-circuit would silently corrupt their measurements.
 * Never honored in production builds.
 */
function rateLimitsDisabled(): boolean {
  return (
    process.env.DISABLE_RATE_LIMITS === "true" &&
    process.env.NODE_ENV !== "production"
  );
}

export function checkApiRateLimit(
  request: NextRequest,
  config: ApiRateLimitConfig
): NextResponse | null {
  if (rateLimitsDisabled()) {
    return null;
  }

  const ip = getClientIP(request);
  const key = `${config.prefix}:${ip}`;

  const result = checkRateLimit(key, config.limit, config.windowMs);

  if (!result.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(result.resetIn / 1000)),
          "X-RateLimit-Limit": String(config.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(result.resetIn / 1000)),
        },
      }
    );
  }

  return null;
}
