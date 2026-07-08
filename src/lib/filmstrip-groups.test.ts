import { describe, it, expect } from "vitest";
import { SourceType } from "@/generated/prisma/enums";
import { dedupeFilmstripGroups } from "./filmstrip-groups";

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
