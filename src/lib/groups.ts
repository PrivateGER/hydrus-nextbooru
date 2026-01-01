import { prisma as defaultPrisma } from "@/lib/db";
import { SourceType, Prisma, PrismaClient } from "@/generated/prisma/client";

export type OrderOption = "random" | "newest" | "oldest" | "largest";

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
  }>;
  postCount: number;
  posts: Array<{
    postId: number;
    groupId: number;
    position: number;
    post: {
      hash: string;
      width: number | null;
      height: number | null;
    };
  }>;
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
    SELECT g."sourceType", COUNT(*)::bigint as count
    FROM "Group" g
    WHERE (SELECT COUNT(*) FROM "PostGroup" pg WHERE pg."groupId" = g.id) >= 2
    GROUP BY g."sourceType"
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
    postCount: bigint;
  }[]>`
    WITH group_content AS (
      SELECT
        g.id as group_id,
        g."sourceType",
        g."sourceId",
        MD5(STRING_AGG(pg."postId"::text, ',' ORDER BY pg."postId")) as content_hash,
        COUNT(pg."postId")::bigint as post_count
      FROM "Group" g
      JOIN "PostGroup" pg ON pg."groupId" = g.id
      ${typeFilter ? Prisma.sql`WHERE g."sourceType" = ${typeFilter}::"SourceType"` : Prisma.empty}
      GROUP BY g.id
      HAVING COUNT(pg."postId") >= 2
    )
    SELECT
      content_hash as "contentHash",
      ARRAY_AGG(group_id ORDER BY group_id) as "groupIds",
      ARRAY_AGG("sourceType"::text ORDER BY group_id) as "sourceTypes",
      ARRAY_AGG("sourceId" ORDER BY group_id) as "sourceIds",
      MAX(post_count) as "postCount",
      MIN(group_id) as min_group_id,
      MAX(post_count) as max_post_count
    FROM group_content
    GROUP BY content_hash
    ${orderClause}
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  // Fetch posts for all groups
  const allGroupIds = mergedGroupsRaw.flatMap(g => g.groupIds);
  const groupPosts = allGroupIds.length > 0 ? await prisma.postGroup.findMany({
    where: { groupId: { in: allGroupIds } },
    include: {
      post: {
        select: {
          hash: true,
          width: true,
          height: true,
        },
      },
    },
    orderBy: { position: "asc" },
  }) : [];

  // Group posts by groupId
  const postsByGroup = new Map<number, typeof groupPosts>();
  for (const pg of groupPosts) {
    const existing = postsByGroup.get(pg.groupId) || [];
    existing.push(pg);
    postsByGroup.set(pg.groupId, existing);
  }

  // Combine data
  const groups: MergedGroup[] = mergedGroupsRaw.map(g => ({
    contentHash: g.contentHash,
    groups: g.groupIds.map((id, i) => ({
      id,
      sourceType: g.sourceTypes[i] as SourceType,
      sourceId: g.sourceIds[i],
    })),
    postCount: Number(g.postCount),
    posts: (postsByGroup.get(g.groupIds[0]) || []).slice(0, 10),
  }));

  // Count total merged groups
  const [{ count: filteredCount }] = await prisma.$queryRaw<{ count: bigint }[]>`
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

  const totalPages = Math.ceil(Number(filteredCount) / pageSize);

  return {
    groups,
    typeCounts,
    totalGroups,
    filteredCount: Number(filteredCount),
    totalPages,
    page,
  };
}
