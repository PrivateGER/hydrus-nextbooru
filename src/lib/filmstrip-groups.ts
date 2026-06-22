import { SourceType } from "@/generated/prisma/enums";

interface FilmstripGroupShape {
  id: number;
  sourceType: SourceType;
  title: string | null;
  memberHash: string | null;
  translation: { translatedContent: string } | null;
  posts: Array<{ post: { id: number } }>;
}

/** Title collection info carried over from a deduplicated TITLE group. */
export interface CarriedCollection {
  groupId: number;
  title: string | null;
}

/**
 * Collapse groups that contain the same set of posts so the post page renders
 * a single filmstrip per distinct image set. A Pixiv work and its synthetic
 * TITLE collection typically share all members; showing both is pure noise.
 *
 * Identity follows the same notion as the merged groups listing: `memberHash`
 * (MD5 of sorted post ids), falling back to the loaded posts' ids when the
 * hash has not been computed yet.
 *
 * Among duplicates the first non-TITLE group survives (it carries the
 * source link); the dropped TITLE group's display title is attached as
 * `collection` so no information is lost.
 */
export function dedupeFilmstripGroups<G extends FilmstripGroupShape>(
  groups: G[]
): Array<G & { collection?: CarriedCollection }> {
  const byMembers = new Map<string, G[]>();

  for (const group of groups) {
    const key =
      group.memberHash ??
      `ids:${group.posts
        .map((p) => p.post.id)
        .sort((a, b) => a - b)
        .join(",")}`;
    const bucket = byMembers.get(key);
    if (bucket) {
      bucket.push(group);
    } else {
      byMembers.set(key, [group]);
    }
  }

  const survivors = new Map<number, G & { collection?: CarriedCollection }>();

  for (const bucket of byMembers.values()) {
    const survivor = bucket.find((g) => g.sourceType !== SourceType.TITLE) ?? bucket[0];
    const droppedTitleGroup =
      survivor.sourceType === SourceType.TITLE
        ? undefined
        : bucket.find((g) => g.sourceType === SourceType.TITLE);

    survivors.set(
      survivor.id,
      droppedTitleGroup
        ? {
            ...survivor,
            collection: {
              groupId: droppedTitleGroup.id,
              title: droppedTitleGroup.translation?.translatedContent ?? droppedTitleGroup.title,
            },
          }
        : survivor
    );
  }

  // Preserve the original relative order of the surviving groups.
  return groups.flatMap((g) => {
    const survivor = survivors.get(g.id);
    if (!survivor) return [];
    survivors.delete(g.id);
    return [survivor];
  });
}
