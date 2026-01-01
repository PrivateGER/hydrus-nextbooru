import { describe, it, expect } from "vitest";
import {
  isWildcardPattern,
  validateWildcardPattern,
  WILDCARD_TAG_LIMIT,
} from "./wildcard";

describe("isWildcardPattern", () => {
  it("should detect wildcard at end", () => {
    expect(isWildcardPattern("character:*")).toBe(true);
  });

  it("should detect wildcard at start", () => {
    expect(isWildcardPattern("*_eyes")).toBe(true);
  });

  it("should detect wildcard in middle", () => {
    expect(isWildcardPattern("blue*eyes")).toBe(true);
  });

  it("should detect multiple wildcards", () => {
    expect(isWildcardPattern("*blue*")).toBe(true);
  });

  it("should return false for non-wildcard patterns", () => {
    expect(isWildcardPattern("blue_eyes")).toBe(false);
    expect(isWildcardPattern("character:saber")).toBe(false);
  });

  it("should handle negated wildcard patterns", () => {
    expect(isWildcardPattern("-character:*")).toBe(true);
    expect(isWildcardPattern("-*_eyes")).toBe(true);
  });

  it("should return false for negated non-wildcard patterns", () => {
    expect(isWildcardPattern("-blue_eyes")).toBe(false);
  });

  it("should handle lone asterisk", () => {
    expect(isWildcardPattern("*")).toBe(true);
  });
});

describe("validateWildcardPattern", () => {
  it("should accept valid patterns", () => {
    expect(validateWildcardPattern("character:*")).toEqual({ valid: true });
    expect(validateWildcardPattern("*_eyes")).toEqual({ valid: true });
    expect(validateWildcardPattern("blu*")).toEqual({ valid: true });
    expect(validateWildcardPattern("-character:*")).toEqual({ valid: true });
  });

  it("should reject standalone asterisk", () => {
    const result = validateWildcardPattern("*");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("too broad");
  });

  it("should reject negated standalone asterisk", () => {
    const result = validateWildcardPattern("-*");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Cannot exclude all tags");
  });

  it("should reject pattern with only wildcards", () => {
    const result = validateWildcardPattern("***");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("non-wildcard characters");
  });

  it("should reject pattern with insufficient literal characters", () => {
    const result = validateWildcardPattern("a*");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("at least 2");
  });

  it("should accept pattern with exactly minimum characters", () => {
    expect(validateWildcardPattern("ab*")).toEqual({ valid: true });
    expect(validateWildcardPattern("*ab")).toEqual({ valid: true });
  });
});

describe("WILDCARD_TAG_LIMIT", () => {
  it("should be 500", () => {
    expect(WILDCARD_TAG_LIMIT).toBe(500);
  });
});
