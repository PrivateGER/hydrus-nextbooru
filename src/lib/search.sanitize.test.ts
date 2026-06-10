import { describe, it, expect } from "vitest";
import { sanitizePositiveInt, normalizePositiveInteger, MAX_PAGE, MAX_LIMIT } from "./search";

/**
 * Guards for ITEM 1: NaN / non-finite values must never reach Prisma take/skip.
 * sanitizePositiveInt parses raw query-string values; normalizePositiveInteger
 * clamps already-numeric values. Both must always yield finite positive ints.
 */
describe("sanitizePositiveInt (page/limit query param sanitizer)", () => {
  const FALLBACK = 1;
  const MAX = 100;

  it("parses a normal numeric string", () => {
    expect(sanitizePositiveInt("5", FALLBACK, MAX)).toBe(5);
  });

  it("falls back on non-numeric input ('abc')", () => {
    expect(sanitizePositiveInt("abc", FALLBACK, MAX)).toBe(FALLBACK);
  });

  it("falls back on empty string", () => {
    expect(sanitizePositiveInt("", FALLBACK, MAX)).toBe(FALLBACK);
  });

  it("falls back on null/undefined (missing param)", () => {
    expect(sanitizePositiveInt(null, FALLBACK, MAX)).toBe(FALLBACK);
    expect(sanitizePositiveInt(undefined, FALLBACK, MAX)).toBe(FALLBACK);
  });

  it("clamps negative input up to 1 ('-5')", () => {
    expect(sanitizePositiveInt("-5", FALLBACK, MAX)).toBe(1);
  });

  it("truncates exponential notation via parseInt ('1e9' -> 1)", () => {
    // parseInt stops at the 'e', yielding 1 (a safe bounded value).
    expect(sanitizePositiveInt("1e9", FALLBACK, MAX)).toBe(1);
  });

  it("clamps large in-range integers to max ('999999')", () => {
    expect(sanitizePositiveInt("999999", FALLBACK, MAX)).toBe(MAX);
  });

  it("floors fractional input ('3.9' -> 3)", () => {
    expect(sanitizePositiveInt("3.9", FALLBACK, MAX)).toBe(3);
  });

  it("always returns a finite positive integer for adversarial inputs", () => {
    for (const raw of ["abc", "", "-5", "1e9", "NaN", "  ", "0", "Infinity", "-Infinity"]) {
      const result = sanitizePositiveInt(raw, FALLBACK, MAX);
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(MAX);
    }
  });

  it("respects real route bounds (MAX_PAGE / MAX_LIMIT)", () => {
    expect(sanitizePositiveInt("abc", 1, MAX_PAGE)).toBe(1);
    expect(sanitizePositiveInt(String(MAX_PAGE * 10), 1, MAX_PAGE)).toBe(MAX_PAGE);
    expect(sanitizePositiveInt("abc", 48, MAX_LIMIT)).toBe(48);
    expect(sanitizePositiveInt("9999", 48, MAX_LIMIT)).toBe(MAX_LIMIT);
  });
});

describe("normalizePositiveInteger (numeric clamp used inside searchPosts)", () => {
  it("returns fallback for NaN", () => {
    expect(normalizePositiveInteger(NaN, 1, 100)).toBe(1);
  });

  it("returns fallback for Infinity / -Infinity", () => {
    expect(normalizePositiveInteger(Infinity, 7, 100)).toBe(7);
    expect(normalizePositiveInteger(-Infinity, 7, 100)).toBe(7);
  });

  it("returns fallback for undefined", () => {
    expect(normalizePositiveInteger(undefined, 9, 100)).toBe(9);
  });

  it("clamps negatives to 1 and floors fractions", () => {
    expect(normalizePositiveInteger(-3, 1, 100)).toBe(1);
    expect(normalizePositiveInteger(4.7, 1, 100)).toBe(4);
  });

  it("clamps to max", () => {
    expect(normalizePositiveInteger(5000, 1, 100)).toBe(100);
  });
});
