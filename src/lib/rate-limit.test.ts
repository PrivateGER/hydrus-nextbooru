import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  checkApiRateLimit,
  checkRateLimit,
  getClientIPFromHeaders,
} from "./rate-limit";

describe("checkRateLimit", () => {
  let keyId = 0;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    keyId++;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function uniqueKey(label: string): string {
    return `test:${label}:${keyId}`;
  }

  it("allows requests until the configured window limit is reached", () => {
    const key = uniqueKey("window");

    expect(checkRateLimit(key, 2, 1_000)).toEqual({
      allowed: true,
      remaining: 1,
      resetIn: 1_000,
    });
    expect(checkRateLimit(key, 2, 1_000)).toEqual({
      allowed: true,
      remaining: 0,
      resetIn: 1_000,
    });
    expect(checkRateLimit(key, 2, 1_000)).toEqual({
      allowed: false,
      remaining: 0,
      resetIn: 1_000,
    });
  });

  it("resets an exhausted key after its window expires", () => {
    const key = uniqueKey("reset");

    expect(checkRateLimit(key, 1, 1_000).allowed).toBe(true);
    expect(checkRateLimit(key, 1, 1_000).allowed).toBe(false);

    vi.advanceTimersByTime(1_001);

    expect(checkRateLimit(key, 1, 1_000)).toEqual({
      allowed: true,
      remaining: 0,
      resetIn: 1_000,
    });
  });

  it("keeps independent counters per key", () => {
    const firstKey = uniqueKey("first");
    const secondKey = uniqueKey("second");

    expect(checkRateLimit(firstKey, 1, 1_000).allowed).toBe(true);
    expect(checkRateLimit(firstKey, 1, 1_000).allowed).toBe(false);
    expect(checkRateLimit(secondKey, 1, 1_000).allowed).toBe(true);
  });
});

describe("getClientIPFromHeaders", () => {
  function headers(values: Record<string, string | null>) {
    return {
      get(name: string): string | null {
        return values[name.toLowerCase()] ?? null;
      },
    };
  }

  it("uses the first x-forwarded-for address and trims proxy whitespace", () => {
    expect(
      getClientIPFromHeaders(
        headers({ "x-forwarded-for": " 203.0.113.4, 198.51.100.10 " })
      )
    ).toBe("203.0.113.4");
  });

  it("falls back to x-real-ip and then unknown", () => {
    expect(getClientIPFromHeaders(headers({ "x-real-ip": " 198.51.100.7 " }))).toBe(
      "198.51.100.7"
    );
    expect(getClientIPFromHeaders(headers({}))).toBe("unknown");
  });
});

describe("checkApiRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a 429 response with retry headers when an API client is limited", async () => {
    const request = new NextRequest("https://nextbooru.test/api/posts/search", {
      headers: {
        "x-forwarded-for": "203.0.113.42",
      },
    });
    const config = {
      prefix: "unit-api-rate-limit",
      limit: 1,
      windowMs: 2_500,
    };

    expect(checkApiRateLimit(request, config)).toBeNull();

    const response = checkApiRateLimit(request, config);
    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBe("3");
    expect(response?.headers.get("X-RateLimit-Limit")).toBe("1");
    expect(response?.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(response?.headers.get("X-RateLimit-Reset")).toBe("3");
    await expect(response?.json()).resolves.toEqual({
      error: "Too many requests. Please try again later.",
    });
  });
});
