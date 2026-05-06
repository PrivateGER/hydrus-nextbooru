import { describe, expect, it } from "vitest";
import {
  getBaseTagName,
  isNegatedTag,
  isValidSha256Hash,
  isWildcardTag,
  toggleTagNegation,
} from "./tag-utils";

describe("tag-utils", () => {
  it("treats only non-empty dash-prefixed tags as negated", () => {
    expect(isNegatedTag("-artist:name")).toBe(true);
    expect(isNegatedTag("-")).toBe(false);
    expect(isNegatedTag("artist:-name")).toBe(false);
  });

  it("detects wildcards after stripping a valid negation prefix", () => {
    expect(isWildcardTag("-artist:*")).toBe(true);
    expect(isWildcardTag("series:chapter*")).toBe(true);
    expect(isWildcardTag("-")).toBe(false);
    expect(isWildcardTag("plain-tag")).toBe(false);
  });

  it("normalizes and toggles negation without corrupting literal dash tags", () => {
    expect(getBaseTagName("-character:name")).toBe("character:name");
    expect(getBaseTagName("-")).toBe("-");
    expect(toggleTagNegation("-character:name")).toBe("character:name");
    expect(toggleTagNegation("character:name")).toBe("-character:name");
    expect(toggleTagNegation("-")).toBe("--");
  });

  it("validates SHA256 hashes after trimming surrounding whitespace", () => {
    const hash = "a".repeat(64);

    expect(isValidSha256Hash(` ${hash}\n`)).toBe(true);
    expect(isValidSha256Hash("g".repeat(64))).toBe(false);
    expect(isValidSha256Hash("a".repeat(63))).toBe(false);
    expect(isValidSha256Hash(`a${"b".repeat(64)}`)).toBe(false);
  });
});
