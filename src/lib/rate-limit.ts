import { NextRequest, NextResponse } from "next/server";

/**
 * Simple in-memory rate limiter.
 * Sliding window with lazy cleanup.
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

/**
 * Extract client IP from request headers.
 */
function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP.trim();
  }

  // Fallback for direct connections (development)
  return "unknown";
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
export function checkApiRateLimit(
  request: NextRequest,
  config: ApiRateLimitConfig
): NextResponse | null {
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
