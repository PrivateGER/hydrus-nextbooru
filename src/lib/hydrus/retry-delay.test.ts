import { describe, it, expect } from "vitest";
import { getRetryDelayMs } from "./client";

/**
 * Guard for ITEM 2: exponential backoff (100ms * 2^attempt) must be capped so
 * no single retry sleep can grow unbounded (~51s at attempt 9 uncapped).
 */
describe("getRetryDelayMs (capped exponential backoff)", () => {
  it("grows exponentially while below the cap", () => {
    expect(getRetryDelayMs(0)).toBe(100);
    expect(getRetryDelayMs(1)).toBe(200);
    expect(getRetryDelayMs(2)).toBe(400);
    expect(getRetryDelayMs(3)).toBe(800);
    expect(getRetryDelayMs(4)).toBe(1600);
    expect(getRetryDelayMs(5)).toBe(3200);
  });

  it("caps any single delay at 5000ms once the curve exceeds it", () => {
    // 100 * 2^6 = 6400 -> capped to 5000
    expect(getRetryDelayMs(6)).toBe(5000);
    expect(getRetryDelayMs(7)).toBe(5000);
    expect(getRetryDelayMs(9)).toBe(5000);
  });

  it("never exceeds the cap for any attempt up to the max retry count", () => {
    for (let attempt = 0; attempt <= 10; attempt++) {
      expect(getRetryDelayMs(attempt)).toBeLessThanOrEqual(5000);
      expect(getRetryDelayMs(attempt)).toBeGreaterThan(0);
    }
  });
});
