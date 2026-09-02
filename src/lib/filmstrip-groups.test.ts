import { describe, it, expect } from "vitest";
import { SourceType } from "@/generated/prisma/enums";
import { dedupeFilmstripGroups, windowFilmstrip, FILMSTRIP_RADIUS } from "./filmstrip-groups";

interface TestGroup {
  id: number;
  sourceType: SourceType;
  sourceId: string;
  title: string | null;
  translation: { translatedContent: string } | null;
  posts: Array<{ post: { id: number } }>;
}

function makeGroup(overrides: Partial<TestGroup> & { id: number }): TestGroup {
  return {
    sourceType: SourceType.PIXIV,
    sourceId: String(overrides.id),
    title: null,
    translation: null,
    posts: [{ post: { id: 1 } }, { post: { id: 2 } }],
    ...overrides,
  };
}

describe("dedupeFilmstripGroups", () => {
  it("keeps groups with distinct members untouched", () => {
    const groups = [
      makeGroup({ id: 1 }),
      makeGroup({ id: 2, posts: [{ post: { id: 3 } }, { post: { id: 4 } }] }),
    ];

    const result = dedupeFilmstripGroups(groups);

    expect(result.map((g) => g.id)).toEqual([1, 2]);
    expect(result[0].collection).toBeUndefined();
    expect(result[1].collection).toBeUndefined();
    expect(result[0].duplicateGroupIds).toEqual([]);
  });

  it("drops a TITLE group that duplicates a source group, carrying its title and id over", () => {
    const groups = [
      makeGroup({ id: 1, sourceType: SourceType.PIXIV }),
      makeGroup({
        id: 2,
        sourceType: SourceType.TITLE,
        title: "devils-of-delusion : nangong yu",
      }),
    ];

    const result = dedupeFilmstripGroups(groups);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].collection).toEqual({
      groupId: 2,
      title: "devils-of-delusion : nangong yu",
    });
    expect(result[0].duplicateGroupIds).toEqual([2]);
  });

  it("prefers the non-TITLE survivor even when the TITLE group comes first", () => {
    const groups = [
      makeGroup({ id: 1, sourceType: SourceType.TITLE, title: "collection" }),
      makeGroup({ id: 2, sourceType: SourceType.TWITTER }),
    ];

    const result = dedupeFilmstripGroups(groups);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
    expect(result[0].collection).toEqual({ groupId: 1, title: "collection" });
    expect(result[0].duplicateGroupIds).toEqual([1]);
  });

  it("uses the translated title when one exists", () => {
    const groups = [
      makeGroup({ id: 1, sourceType: SourceType.PIXIV }),
      makeGroup({
        id: 2,
        sourceType: SourceType.TITLE,
        title: "妄想エンジェル",
        translation: { translatedContent: "Delusion Angel" },
      }),
    ];

    const result = dedupeFilmstripGroups(groups);

    expect(result[0].collection).toEqual({ groupId: 2, title: "Delusion Angel" });
  });

  it("keeps the first TITLE group when all duplicates are TITLE groups", () => {
    const groups = [
      makeGroup({ id: 1, sourceType: SourceType.TITLE, title: "first" }),
      makeGroup({ id: 2, sourceType: SourceType.TITLE, title: "second" }),
    ];

    const result = dedupeFilmstripGroups(groups);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    // The survivor already renders its own title; no carried collection needed.
    expect(result[0].collection).toBeUndefined();
    expect(result[0].duplicateGroupIds).toEqual([2]);
  });

  it("keeps groups with the same members in a different order separate", () => {
    // Same set, different reading order: these are materially different
    // collections and both must render so ?in= can target either.
    const groups = [
      makeGroup({ id: 1, sourceType: SourceType.PIXIV, posts: [{ post: { id: 7 } }, { post: { id: 8 } }] }),
      makeGroup({
        id: 2,
        sourceType: SourceType.TITLE,
        title: "reordered",
        posts: [{ post: { id: 8 } }, { post: { id: 7 } }],
      }),
    ];

    const result = dedupeFilmstripGroups(groups);

    expect(result.map((g) => g.id)).toEqual([1, 2]);
    expect(result[0].collection).toBeUndefined();
  });

  it("does not merge a subset group into a superset group", () => {
    const groups = [
      makeGroup({ id: 1, posts: [{ post: { id: 1 } }, { post: { id: 2 } }, { post: { id: 3 } }] }),
      makeGroup({
        id: 2,
        sourceType: SourceType.TITLE,
        title: "subset",
        posts: [{ post: { id: 1 } }, { post: { id: 2 } }],
      }),
    ];

    const result = dedupeFilmstripGroups(groups);

    expect(result).toHaveLength(2);
  });

  it("handles an empty group list", () => {
    expect(dedupeFilmstripGroups([])).toEqual([]);
  });
});

describe("windowFilmstrip", () => {
  const size = 2 * FILMSTRIP_RADIUS + 1;
  const members = (n: number) => Array.from({ length: n }, (_, i) => ({ post: { hash: `h${i}` } }));
  const hashes = (w: { posts: Array<{ post: { hash: string } }> }) => w.posts.map((p) => p.post.hash);

  it("returns the whole group untouched when it fits the window", () => {
    const posts = members(size);
    const w = windowFilmstrip(posts, "h3");
    expect(w).toEqual({ posts, offset: 0, total: size });
  });

  it("centers the window on the current post", () => {
    const posts = members(300);
    const w = windowFilmstrip(posts, "h150");
    expect(w.offset).toBe(150 - FILMSTRIP_RADIUS);
    expect(w.total).toBe(300);
    expect(w.posts).toHaveLength(size);
    expect(hashes(w)[FILMSTRIP_RADIUS]).toBe("h150");
  });

  it("clamps to the start and end without shrinking the window", () => {
    const posts = members(300);
    const start = windowFilmstrip(posts, "h2");
    expect(start.offset).toBe(0);
    expect(hashes(start)[0]).toBe("h0");
    expect(start.posts).toHaveLength(size);

    const end = windowFilmstrip(posts, "h298");
    expect(end.offset).toBe(300 - size);
    expect(hashes(end).at(-1)).toBe("h299");
    expect(end.posts).toHaveLength(size);
  });

  it("windows from the start when the current post is not a member", () => {
    const w = windowFilmstrip(members(300), "missing");
    expect(w.offset).toBe(0);
    expect(hashes(w)[0]).toBe("h0");
    expect(w.posts).toHaveLength(size);
  });
});
