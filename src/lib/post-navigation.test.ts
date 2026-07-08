import { describe, it, expect } from "vitest";
import { SourceType } from "@/generated/prisma/enums";
import {
  selectNavigationGroup,
  buildPostUrl,
  parseGroupIdParam,
} from "./post-navigation";

function group(
  id: number,
  sourceType: SourceType,
  memberCount: number
): { id: number; sourceType: SourceType; posts: Array<{ post: { hash: string } }> } {
  return {
    id,
    sourceType,
    posts: Array.from({ length: memberCount }, (_, i) => ({
      post: { hash: `hash-${id}-${i}` },
    })),
  };
}

describe("selectNavigationGroup", () => {
  it("returns undefined when no group has more than one post", () => {
    expect(selectNavigationGroup([])).toBeUndefined();
    expect(selectNavigationGroup([group(1, SourceType.PIXIV, 1)])).toBeUndefined();
  });

  it("honors the requested group id when the post belongs to it", () => {
    const groups = [group(1, SourceType.PIXIV, 5), group(2, SourceType.TITLE, 10)];
    expect(selectNavigationGroup(groups, 2)?.id).toBe(2);
  });

  it("ignores a requested group id the post does not belong to", () => {
    const groups = [group(1, SourceType.PIXIV, 5)];
    expect(selectNavigationGroup(groups, 99)?.id).toBe(1);
  });

  it("ignores a requested group with a single post", () => {
    const groups = [group(1, SourceType.PIXIV, 5), group(2, SourceType.TITLE, 1)];
    expect(selectNavigationGroup(groups, 2)?.id).toBe(1);
  });

  it("prefers non-TITLE source groups over TITLE collections", () => {
    const groups = [group(1, SourceType.TITLE, 20), group(2, SourceType.PIXIV, 3)];
    expect(selectNavigationGroup(groups)?.id).toBe(2);
  });

  it("prefers larger groups within the same tier", () => {
    const groups = [group(1, SourceType.PIXIV, 3), group(2, SourceType.TWITTER, 8)];
    expect(selectNavigationGroup(groups)?.id).toBe(2);
  });

  it("breaks remaining ties by lowest group id, regardless of input order", () => {
    const a = group(7, SourceType.PIXIV, 4);
    const b = group(3, SourceType.TWITTER, 4);
    expect(selectNavigationGroup([a, b])?.id).toBe(3);
    expect(selectNavigationGroup([b, a])?.id).toBe(3);
  });

  it("falls back to a TITLE group when it is the only multi-post group", () => {
    const groups = [group(1, SourceType.TITLE, 4), group(2, SourceType.PIXIV, 1)];
    expect(selectNavigationGroup(groups)?.id).toBe(1);
  });
});

describe("buildPostUrl", () => {
  it("builds a bare post URL without group context", () => {
    expect(buildPostUrl("abc")).toBe("/post/abc");
  });

  it("carries the group context as ?in=", () => {
    expect(buildPostUrl("abc", 42)).toBe("/post/abc?in=42");
  });
});

describe("parseGroupIdParam", () => {
  it("parses a valid id", () => {
    expect(parseGroupIdParam("42")).toBe(42);
  });

  it("rejects missing, repeated, and malformed values", () => {
    expect(parseGroupIdParam(undefined)).toBeUndefined();
    expect(parseGroupIdParam(["1", "2"])).toBeUndefined();
    expect(parseGroupIdParam("abc")).toBeUndefined();
    expect(parseGroupIdParam("1.5")).toBeUndefined();
    expect(parseGroupIdParam("-3")).toBeUndefined();
    expect(parseGroupIdParam("0")).toBeUndefined();
  });
});
