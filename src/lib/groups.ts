import { prisma as defaultPrisma } from "@/lib/db";
import { SourceType, Prisma, PrismaClient } from "@/generated/prisma/client";

export type OrderOption = "random" | "newest" | "oldest" | "largest";
const GROUP_PREVIEW_POST_LIMIT = 10;

export interface GroupsSearchParams {
  typeFilter?: SourceType;
  order?: OrderOption;
  page?: number;
  pageSize?: number;
  seed?: string;
}

export interface MergedGroup {
  contentHash: string;
  groups: Array<{
    id: number;
    sourceType: SourceType;
    sourceId: string;
    title: string | null;
    translatedTitle: string | null;
  }>;
  postCount: number;
  creators: string[];
  posts: Array<{
    postId: number;
    groupId: number;
    position: number;
    post: {
      id: number;
      hash: string;
      width: number | null;
      height: number | null;
    };
  }>;
}

/** Matches Pixiv placeholder usernames like "user abcd1234" or "user_abcd1234" */
export const PIXIV_USER_PATTERN = /^user[\s_]*[a-z]{4}\d{4}$/i;

/** Checks if a creator name is valid (not numeric-only or Pixiv placeholder) */
export function isValidCreatorName(name: string): boolean {
  if (/^\d+$/.test(name)) return false;
  if (PIXIV_USER_PATTERN.test(name)) return false;
  return true;
}

export interface TypeCount {
  sourceType: SourceType;
  count: number;
}

export interface GroupsSearchResult {
  groups: MergedGroup[];
  typeCounts: TypeCount[];
  totalGroups: number;
  filteredCount: number;
  totalPages: number;
  page: number;
}

/**
 * Get counts of groups by source type (only groups with 2+ members)
 */
export async function getGroupTypeCounts(prisma: PrismaClient = defaultPrisma): Promise<TypeCount[]> {
  const typeCountsRaw = await prisma.$queryRaw<{ sourceType: string; count: bigint }[]>`
    SELECT "sourceType", COUNT(*)::bigint as count
    FROM (
      SELECT g.id, g."sourceType"
      FROM "Group" g
      JOIN "PostGroup" pg ON pg."groupId" = g.id
      GROUP BY g.id
      HAVING COUNT(pg."postId") >= 2
    ) eligible_groups
    GROUP BY "sourceType"
    ORDER BY count DESC
  `;

  return typeCountsRaw.map(r => ({
    sourceType: r.sourceType as SourceType,
    count: Number(r.count),
  }));
}

/**
 * Search for merged groups with pagination and ordering
 */
export async function searchGroups(
  params: GroupsSearchParams = {},
  prisma: PrismaClient = defaultPrisma
): Promise<GroupsSearchResult> {
  const {
    typeFilter,
    order = "random",
    page = 1,
    pageSize = 50,
    seed = "",
  } = params;

  const offset = (page - 1) * pageSize;

  // Get type counts
  const typeCounts = await getGroupTypeCounts(prisma);
  const totalGroups = typeCounts.reduce((sum, t) => sum + t.count, 0);

  // Build order clause
  const orderClause = {
    random: Prisma.sql`ORDER BY MD5(content_hash || ${seed}) ASC`,
    newest: Prisma.sql`ORDER BY min_group_id DESC`,
    oldest: Prisma.sql`ORDER BY min_group_id ASC`,
    largest: Prisma.sql`ORDER BY max_post_count DESC, min_group_id DESC`,
  }[order];

  // Get merged groups - groups with identical posts are combined
  const mergedGroupsRaw = await prisma.$queryRaw<{
    contentHash: string;
    groupIds: number[];
    sourceTypes: string[];
    sourceIds: string[];
    titles: (string | null)[];
    translatedTitles: (string | null)[];
    postCount: bigint;
    filteredCount: bigint;
  }[]>`
    WITH group_content AS (
      SELECT
        g.id as group_id,
        g."sourceType",
        g."sourceId",
        g."title",
        ct."translatedContent" as translated_title,
        MD5(STRING_AGG(pg."postId"::text, ',' ORDER BY pg."postId")) as content_hash,
        COUNT(pg."postId")::bigint as post_count
      FROM "Group" g
      JOIN "PostGroup" pg ON pg."groupId" = g.id
      LEFT JOIN "ContentTranslation" ct ON g."titleHash" = ct."contentHash"
      ${typeFilter ? Prisma.sql`WHERE g."sourceType" = ${typeFilter}::"SourceType"` : Prisma.empty}
      GROUP BY g.id, ct."translatedContent"
      HAVING COUNT(pg."postId") >= 2
    )
    SELECT
      content_hash as "contentHash",
      ARRAY_AGG(group_id ORDER BY group_id) as "groupIds",
      ARRAY_AGG("sourceType"::text ORDER BY group_id) as "sourceTypes",
      ARRAY_AGG("sourceId" ORDER BY group_id) as "sourceIds",
      ARRAY_AGG("title" ORDER BY group_id) as "titles",
      ARRAY_AGG(translated_title ORDER BY group_id) as "translatedTitles",
      MAX(post_count) as "postCount",
      MIN(group_id) as min_group_id,
      MAX(post_count) as max_post_count,
      COUNT(*) OVER() as "filteredCount"
    FROM group_content
    GROUP BY content_hash
    ${orderClause}
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const representativeGroupIds = mergedGroupsRaw.map((group) => group.groupIds[0]);
  const groupPostsRaw = representativeGroupIds.length > 0 ? await prisma.$queryRaw<{
    postId: number;
    groupId: number;
    position: number;
    id: number;
    hash: string;
    width: number | null;
    height: number | null;
  }[]>`
    WITH ranked_group_posts AS (
      SELECT
        pg."postId",
        pg."groupId",
        pg.position,
        p.id,
        p.hash,
        p.width,
        p.height,
        ROW_NUMBER() OVER (PARTITION BY pg."groupId" ORDER BY pg.position ASC, pg."postId" ASC) AS row_number
      FROM "PostGroup" pg
      JOIN "Post" p ON p.id = pg."postId"
      WHERE pg."groupId" = ANY(${representativeGroupIds}::int[])
    )
    SELECT
      "postId",
      "groupId",
      position,
      id,
      hash,
      width,
      height
    FROM ranked_group_posts
    WHERE row_number <= ${GROUP_PREVIEW_POST_LIMIT}
    ORDER BY "groupId" ASC, position ASC, "postId" ASC
  ` : [];

  const groupPosts: MergedGroup["posts"] = groupPostsRaw.map((row) => ({
    postId: row.postId,
    groupId: row.groupId,
    position: row.position,
    post: {
      id: row.id,
      hash: row.hash,
      width: row.width,
      height: row.height,
    },
  }));

  // Group posts by groupId
  const postsByGroup = new Map<number, typeof groupPosts>();
  for (const pg of groupPosts) {
    const existing = postsByGroup.get(pg.groupId) || [];
    existing.push(pg);
    postsByGroup.set(pg.groupId, existing);
  }

  // Fetch artist tags for all posts across all groups
  const allPostIds = [...new Set(groupPosts.map(pg => pg.post.id))];
  const artistTagsRaw = allPostIds.length > 0 ? await prisma.$queryRaw<{
    postId: number;
    name: string;
  }[]>`
    SELECT pt."postId", t.name
    FROM "PostTag" pt
    JOIN "Tag" t ON t.id = pt."tagId"
    WHERE pt."postId" = ANY(${allPostIds}::int[])
      AND t.category = 'ARTIST'::"TagCategory"
    ORDER BY t."postCount" DESC
  ` : [];

  // Group artist tags by postId
  const artistsByPost = new Map<number, string[]>();
  for (const row of artistTagsRaw) {
    const existing = artistsByPost.get(row.postId) || [];
    existing.push(row.name);
    artistsByPost.set(row.postId, existing);
  }

  // Combine data
  const groups: MergedGroup[] = mergedGroupsRaw.map(g => {
    const posts = (postsByGroup.get(g.groupIds[0]) || []).slice(0, 10);

    // Collect unique creators from all posts in this group
    const creatorSet = new Set<string>();
    for (const pg of posts) {
      const artists = artistsByPost.get(pg.post.id) || [];
      for (const artist of artists) {
        if (isValidCreatorName(artist)) {
          creatorSet.add(artist);
        }
      }
    }

    return {
      contentHash: g.contentHash,
      groups: g.groupIds.map((id, i) => ({
        id,
        sourceType: g.sourceTypes[i] as SourceType,
        sourceId: g.sourceIds[i],
        title: g.titles[i],
        translatedTitle: g.translatedTitles[i],
      })),
      postCount: Number(g.postCount),
      creators: [...creatorSet].slice(0, 3),
      posts,
    };
  });

  let filteredCount = Number(mergedGroupsRaw[0]?.filteredCount ?? 0n);
  if (filteredCount === 0 && offset > 0) {
    const [{ count }] = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT content_hash)::bigint as count FROM (
        SELECT
          MD5(STRING_AGG(pg."postId"::text, ',' ORDER BY pg."postId")) as content_hash
        FROM "Group" g
        JOIN "PostGroup" pg ON pg."groupId" = g.id
        ${typeFilter ? Prisma.sql`WHERE g."sourceType" = ${typeFilter}::"SourceType"` : Prisma.empty}
        GROUP BY g.id
        HAVING COUNT(pg."postId") >= 2
      ) sub
    `;
    filteredCount = Number(count);
  }

  const totalPages = Math.ceil(filteredCount / pageSize);

  return {
    groups,
    typeCounts,
    totalGroups,
    filteredCount,
    totalPages,
    page,
  };
}
