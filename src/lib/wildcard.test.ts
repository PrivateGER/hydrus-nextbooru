import { describe, it, expect } from "vitest";
import {
  isWildcardPattern,
  getBasePattern,
  isNegatedPattern,
  wildcardToSqlPattern,
  validateWildcardPattern,
  separateWildcardPatterns,
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

describe("getBasePattern", () => {
  it("should return pattern as-is when not negated", () => {
    expect(getBasePattern("character:*")).toBe("character:*");
    expect(getBasePattern("blue_eyes")).toBe("blue_eyes");
  });

  it("should strip negation prefix", () => {
    expect(getBasePattern("-character:*")).toBe("character:*");
    expect(getBasePattern("-blue_eyes")).toBe("blue_eyes");
  });

  it("should not strip lone hyphen", () => {
    expect(getBasePattern("-")).toBe("-");
  });
});

describe("isNegatedPattern", () => {
  it("should return true for negated patterns", () => {
    expect(isNegatedPattern("-character:*")).toBe(true);
    expect(isNegatedPattern("-tag")).toBe(true);
  });

  it("should return false for non-negated patterns", () => {
    expect(isNegatedPattern("character:*")).toBe(false);
    expect(isNegatedPattern("tag")).toBe(false);
  });

  it("should return false for lone hyphen", () => {
    expect(isNegatedPattern("-")).toBe(false);
  });

  it("should handle hyphenated tags", () => {
    // "blue-eyes" is not a negation
    expect(isNegatedPattern("blue-eyes")).toBe(false);
  });
});

describe("wildcardToSqlPattern", () => {
  it("should convert trailing wildcard", () => {
    expect(wildcardToSqlPattern("character:*")).toBe("character:%");
  });

  it("should convert leading wildcard", () => {
    // Note: _ is escaped because it's a SQL wildcard character
    expect(wildcardToSqlPattern("*_eyes")).toBe("%\\_eyes");
  });

  it("should convert middle wildcard", () => {
    expect(wildcardToSqlPattern("blue*eyes")).toBe("blue%eyes");
  });

  it("should convert multiple wildcards", () => {
    expect(wildcardToSqlPattern("*blue*")).toBe("%blue%");
  });

  it("should escape SQL special characters", () => {
    // % should be escaped before * is converted
    expect(wildcardToSqlPattern("100%*")).toBe("100\\%%");
    // _ should be escaped
    expect(wildcardToSqlPattern("blue_*")).toBe("blue\\_%");
    // \ should be escaped
    expect(wildcardToSqlPattern("path\\*")).toBe("path\\\\%");
  });

  it("should handle pattern with no wildcards", () => {
    expect(wildcardToSqlPattern("exact_match")).toBe("exact\\_match");
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

describe("separateWildcardPatterns", () => {
  it("should separate regular tags from wildcards", () => {
    const result = separateWildcardPatterns([
      "blue_eyes",
      "character:*",
      "blonde_hair",
      "*sword*",
    ]);
    expect(result.regularTags).toEqual(["blue_eyes", "blonde_hair"]);
    expect(result.wildcardPatterns).toEqual(["character:*", "*sword*"]);
  });

  it("should handle all regular tags", () => {
    const result = separateWildcardPatterns(["tag1", "tag2", "tag3"]);
    expect(result.regularTags).toEqual(["tag1", "tag2", "tag3"]);
    expect(result.wildcardPatterns).toEqual([]);
  });

  it("should handle all wildcard patterns", () => {
    const result = separateWildcardPatterns(["*tag1", "tag2*", "*tag3*"]);
    expect(result.regularTags).toEqual([]);
    expect(result.wildcardPatterns).toEqual(["*tag1", "tag2*", "*tag3*"]);
  });

  it("should handle empty array", () => {
    const result = separateWildcardPatterns([]);
    expect(result.regularTags).toEqual([]);
    expect(result.wildcardPatterns).toEqual([]);
  });

  it("should preserve negation prefixes", () => {
    const result = separateWildcardPatterns([
      "-blue_eyes",
      "-character:*",
      "blonde_hair",
    ]);
    expect(result.regularTags).toEqual(["-blue_eyes", "blonde_hair"]);
    expect(result.wildcardPatterns).toEqual(["-character:*"]);
  });
});

describe("WILDCARD_TAG_LIMIT", () => {
  it("should be 500", () => {
    expect(WILDCARD_TAG_LIMIT).toBe(500);
  });
});
