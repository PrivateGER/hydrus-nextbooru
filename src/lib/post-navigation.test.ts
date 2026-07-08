import { describe, it, expect } from "vitest";
import { SourceType } from "@/generated/prisma/enums";
import {
  selectNavigationGroup,
  buildPostUrl,
  parseGroupIdParam,
  parseSearchContext,
  searchContextQuery,
  buildSearchPostUrl,
  searchContextBackUrl,
  parseGalleryContext,
  galleryContextQuery,
  buildGalleryPostUrl,
  galleryContextBackUrl,
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

  it("resolves a requested id absorbed during filmstrip dedupe to its survivor", () => {
    // Group 9 was deduped into group 1 (identical ordered members); group 2
    // is bigger and would win the heuristic, but the request must stay with
    // group 9's behaviorally-identical survivor.
    const groups = [
      { ...group(1, SourceType.PIXIV, 5), duplicateGroupIds: [9] },
      group(2, SourceType.TWITTER, 10),
    ];
    expect(selectNavigationGroup(groups, 9)?.id).toBe(1);
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

describe("parseSearchContext", () => {
  it("parses a search context and normalizes tags like the search page", () => {
    expect(parseSearchContext("search", " Blue_Sky ,-cat, ,")).toEqual({
      tags: ["blue_sky", "-cat"],
    });
  });

  it("rejects other or missing ctx values", () => {
    expect(parseSearchContext(undefined, "a")).toBeUndefined();
    expect(parseSearchContext("group", "a")).toBeUndefined();
    expect(parseSearchContext(["search", "search"], "a")).toBeUndefined();
  });

  it("rejects missing, repeated, or empty tags", () => {
    expect(parseSearchContext("search", undefined)).toBeUndefined();
    expect(parseSearchContext("search", ["a", "b"])).toBeUndefined();
    expect(parseSearchContext("search", " , ,")).toBeUndefined();
  });

  it("carries a listing page past 1 and drops page 1 or malformed values", () => {
    expect(parseSearchContext("search", "a", "3")).toEqual({ tags: ["a"], page: 3 });
    expect(parseSearchContext("search", "a", "1")).toEqual({ tags: ["a"] });
    expect(parseSearchContext("search", "a", "abc")).toEqual({ tags: ["a"] });
    expect(parseSearchContext("search", "a", ["2", "3"])).toEqual({ tags: ["a"] });
    expect(parseSearchContext("search", "a")).toEqual({ tags: ["a"] });
  });
});

describe("search context URLs", () => {
  const context = { tags: ["blue_sky", "-cat"] };

  it("round-trips through query encoding", () => {
    const query = searchContextQuery(context);
    const params = new URLSearchParams(query);
    expect(parseSearchContext(params.get("ctx")!, params.get("tags")!)).toEqual(context);
  });

  it("round-trips the listing page", () => {
    const paged = { tags: ["a"], page: 3 };
    const params = new URLSearchParams(searchContextQuery(paged));
    expect(
      parseSearchContext(params.get("ctx")!, params.get("tags")!, params.get("page")!)
    ).toEqual(paged);
  });

  it("builds post URLs carrying the context", () => {
    expect(buildSearchPostUrl("abc", context)).toBe(
      "/post/abc?ctx=search&tags=blue_sky%2C-cat"
    );
    expect(buildSearchPostUrl("abc", { tags: ["a"], page: 3 })).toBe(
      "/post/abc?ctx=search&tags=a&page=3"
    );
  });

  it("builds the back-to-results URL, returning to the original page", () => {
    expect(searchContextBackUrl(context)).toBe("/search?tags=blue_sky%2C-cat");
    expect(searchContextBackUrl({ tags: ["a"], page: 3 })).toBe("/search?tags=a&page=3");
  });
});

describe("parseGalleryContext", () => {
  it("parses the default gallery context", () => {
    expect(parseGalleryContext("gallery", undefined, undefined)).toEqual({ sort: "newest" });
  });

  it("parses sort, seed, and page", () => {
    expect(parseGalleryContext("gallery", "oldest", undefined, "3")).toEqual({
      sort: "oldest",
      page: 3,
    });
    expect(parseGalleryContext("gallery", "random", "abcd1234")).toEqual({
      sort: "random",
      seed: "abcd1234",
    });
  });

  it("falls back to newest for unknown sorts and drops page 1", () => {
    expect(parseGalleryContext("gallery", "bogus", undefined, "1")).toEqual({ sort: "newest" });
  });

  it("yields no context for random sort without a valid seed", () => {
    expect(parseGalleryContext("gallery", "random", undefined)).toBeUndefined();
    expect(parseGalleryContext("gallery", "random", "UPPERCASE")).toBeUndefined();
    expect(parseGalleryContext("gallery", "random", ["abcd1234", "abcd1234"])).toBeUndefined();
  });

  it("rejects other ctx values", () => {
    expect(parseGalleryContext("search", "newest", undefined)).toBeUndefined();
    expect(parseGalleryContext(undefined, "newest", undefined)).toBeUndefined();
  });
});

describe("gallery context URLs", () => {
  it("omits defaults so the plain gallery yields just ctx=gallery", () => {
    expect(galleryContextQuery({ sort: "newest" })).toBe("ctx=gallery");
  });

  it("round-trips through query encoding", () => {
    const context = { sort: "random" as const, seed: "abcd1234", page: 3 };
    const params = new URLSearchParams(galleryContextQuery(context));
    expect(
      parseGalleryContext(
        params.get("ctx")!,
        params.get("sort")!,
        params.get("seed")!,
        params.get("page")!
      )
    ).toEqual(context);
  });

  it("builds post URLs carrying the context", () => {
    expect(buildGalleryPostUrl("abc", { sort: "oldest", page: 2 })).toBe(
      "/post/abc?ctx=gallery&sort=oldest&page=2"
    );
  });

  it("builds the back-to-gallery URL, mirroring the home page's param shape", () => {
    expect(galleryContextBackUrl({ sort: "newest" })).toBe("/");
    expect(galleryContextBackUrl({ sort: "oldest", page: 2 })).toBe("/?sort=oldest&page=2");
    expect(galleryContextBackUrl({ sort: "random", seed: "abcd1234" })).toBe(
      "/?sort=random&seed=abcd1234"
    );
  });
});
