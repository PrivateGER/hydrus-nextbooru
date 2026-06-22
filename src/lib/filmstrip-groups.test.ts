import { describe, it, expect } from "vitest";
import { SourceType } from "@/generated/prisma/enums";
import { dedupeFilmstripGroups } from "./filmstrip-groups";

interface TestGroup {
  id: number;
  sourceType: SourceType;
  sourceId: string;
  title: string | null;
  memberHash: string | null;
  translation: { translatedContent: string } | null;
  posts: Array<{ post: { id: number } }>;
}

function makeGroup(overrides: Partial<TestGroup> & { id: number }): TestGroup {
  return {
    sourceType: SourceType.PIXIV,
    sourceId: String(overrides.id),
    title: null,
    memberHash: null,
    translation: null,
    posts: [{ post: { id: 1 } }, { post: { id: 2 } }],
    ...overrides,
  };
}

describe("dedupeFilmstripGroups", () => {
  it("keeps groups with distinct member sets untouched", () => {
    const groups = [
      makeGroup({ id: 1, memberHash: "aaa" }),
      makeGroup({ id: 2, memberHash: "bbb", posts: [{ post: { id: 3 } }, { post: { id: 4 } }] }),
    ];

    const result = dedupeFilmstripGroups(groups);

    expect(result.map((g) => g.id)).toEqual([1, 2]);
    expect(result[0].collection).toBeUndefined();
    expect(result[1].collection).toBeUndefined();
  });

  it("drops a TITLE group that duplicates a source group, carrying its title over", () => {
    const groups = [
      makeGroup({ id: 1, sourceType: SourceType.PIXIV, memberHash: "aaa" }),
      makeGroup({
        id: 2,
        sourceType: SourceType.TITLE,
        memberHash: "aaa",
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
  });

  it("prefers the non-TITLE survivor even when the TITLE group comes first", () => {
    const groups = [
      makeGroup({ id: 1, sourceType: SourceType.TITLE, memberHash: "aaa", title: "collection" }),
      makeGroup({ id: 2, sourceType: SourceType.TWITTER, memberHash: "aaa" }),
    ];

    const result = dedupeFilmstripGroups(groups);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
    expect(result[0].collection).toEqual({ groupId: 1, title: "collection" });
  });

  it("uses the translated title when one exists", () => {
    const groups = [
      makeGroup({ id: 1, sourceType: SourceType.PIXIV, memberHash: "aaa" }),
      makeGroup({
        id: 2,
        sourceType: SourceType.TITLE,
        memberHash: "aaa",
        title: "妄想エンジェル",
        translation: { translatedContent: "Delusion Angel" },
      }),
    ];

    const result = dedupeFilmstripGroups(groups);

    expect(result[0].collection).toEqual({ groupId: 2, title: "Delusion Angel" });
  });

  it("keeps the first TITLE group when all duplicates are TITLE groups", () => {
    const groups = [
      makeGroup({ id: 1, sourceType: SourceType.TITLE, memberHash: "aaa", title: "first" }),
      makeGroup({ id: 2, sourceType: SourceType.TITLE, memberHash: "aaa", title: "second" }),
    ];

    const result = dedupeFilmstripGroups(groups);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    // The survivor already renders its own title; no carried collection needed.
    expect(result[0].collection).toBeUndefined();
  });

  it("falls back to comparing post ids when memberHash is missing", () => {
    const groups = [
      makeGroup({ id: 1, sourceType: SourceType.PIXIV, memberHash: null, posts: [{ post: { id: 7 } }, { post: { id: 8 } }] }),
      makeGroup({
        id: 2,
        sourceType: SourceType.TITLE,
        memberHash: null,
        title: "dup",
        posts: [{ post: { id: 8 } }, { post: { id: 7 } }],
      }),
    ];

    const result = dedupeFilmstripGroups(groups);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].collection).toEqual({ groupId: 2, title: "dup" });
  });

  it("does not merge a subset group into a superset group", () => {
    const groups = [
      makeGroup({ id: 1, memberHash: "aaa", posts: [{ post: { id: 1 } }, { post: { id: 2 } }, { post: { id: 3 } }] }),
      makeGroup({
        id: 2,
        sourceType: SourceType.TITLE,
        memberHash: "bbb",
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
