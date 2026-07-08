import { SourceType } from "@/generated/prisma/enums";

interface FilmstripGroupShape {
  id: number;
  sourceType: SourceType;
  title: string | null;
  translation: { translatedContent: string } | null;
  posts: Array<{ post: { id: number } }>;
}

/** Title collection info carried over from a deduplicated TITLE group. */
export interface CarriedCollection {
  groupId: number;
  title: string | null;
}

export type DedupedFilmstripGroup<G> = G & {
  collection?: CarriedCollection;
  /**
   * Ids of groups this survivor absorbed. Navigation context (`?in=`) can
   * name a dropped group — e.g. a link from that group's own page — and
   * must resolve to the survivor, which orders the same posts identically.
   */
  duplicateGroupIds: number[];
};

/**
 * Collapse groups that contain the same posts in the same order so the post
 * page renders a single filmstrip per distinct reading sequence. A Pixiv
 * work and its synthetic TITLE collection typically share all members and
 * ordering; showing both is pure noise.
 *
 * Identity is the ordered member sequence (each group's posts arrive sorted
 * by its own position/postId), NOT the member set: two groups holding the
 * same posts in different reading orders are materially different
 * collections, and both render so `?in=` navigation can target either.
 *
 * Among duplicates the first non-TITLE group survives (it carries the
 * source link); the dropped TITLE group's display title is attached as
 * `collection` and every dropped id is recorded in `duplicateGroupIds`,
 * so no information is lost.
 */
export function dedupeFilmstripGroups<G extends FilmstripGroupShape>(
  groups: G[]
): Array<DedupedFilmstripGroup<G>> {
  const byOrderedMembers = new Map<string, G[]>();

  for (const group of groups) {
    const key = group.posts.map((p) => p.post.id).join(",");
    const bucket = byOrderedMembers.get(key);
    if (bucket) {
      bucket.push(group);
    } else {
      byOrderedMembers.set(key, [group]);
    }
  }

  const survivors = new Map<number, DedupedFilmstripGroup<G>>();

  for (const bucket of byOrderedMembers.values()) {
    const survivor = bucket.find((g) => g.sourceType !== SourceType.TITLE) ?? bucket[0];
    const dropped = bucket.filter((g) => g.id !== survivor.id);
    const droppedTitleGroup =
      survivor.sourceType === SourceType.TITLE
        ? undefined
        : dropped.find((g) => g.sourceType === SourceType.TITLE);

    survivors.set(survivor.id, {
      ...survivor,
      duplicateGroupIds: dropped.map((g) => g.id),
      ...(droppedTitleGroup && {
        collection: {
          groupId: droppedTitleGroup.id,
          title: droppedTitleGroup.translation?.translatedContent ?? droppedTitleGroup.title,
        },
      }),
    });
  }

  // Preserve the original relative order of the surviving groups.
  return groups.flatMap((g) => {
    const survivor = survivors.get(g.id);
    if (!survivor) return [];
    survivors.delete(g.id);
    return [survivor];
  });
}
