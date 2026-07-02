import { escapeSqlLike, prisma as defaultPrisma } from "@/lib/db";
import { SourceType, Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  isValidCreatorName,
  NUMERIC_CREATOR_SQL_PATTERN,
  PIXIV_USER_SQL_PATTERN,
} from "@/lib/creator-names";
import { seedToHexCursor } from "@/lib/random-order";

export { PIXIV_USER_PATTERN, isValidCreatorName } from "@/lib/creator-names";

export type OrderOption = "random" | "newest" | "oldest" | "largest";
const GROUP_PREVIEW_POST_LIMIT = 10;

export interface GroupsSearchParams {
  typeFilter?: SourceType;
  query?: string;
  creatorFilter?: string;
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

export interface TypeCount {
  sourceType: SourceType;
  count: number;
}

interface GroupListStats {
  typeCounts: TypeCount[];
  mergedTotal: number;
}

export interface GroupsSearchResult {
  groups: MergedGroup[];
  typeCounts: TypeCount[];
  totalGroups: number;
  /** Total merged (content-hash collapsed) groups ignoring filters - denominator for "X of Y" */
  mergedTotal: number;
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
    FROM "Group"
    WHERE "memberCount" >= 2
      AND "memberHash" IS NOT NULL
    GROUP BY "sourceType"
    ORDER BY count DESC
  `;

  return typeCountsRaw.map(r => ({
    sourceType: r.sourceType as SourceType,
    count: Number(r.count),
  }));
}

async function getGroupListStats(prisma: PrismaClient): Promise<GroupListStats> {
  const rows = await prisma.$queryRaw<Array<{
    sourceType: string | null;
    count: bigint | null;
    mergedTotal: bigint | null;
  }>>`
    WITH eligible_group_content AS (
      SELECT
        g.id,
        g."sourceType",
        g."memberHash" as content_hash
      FROM "Group" g
      WHERE g."memberCount" >= 2
        AND g."memberHash" IS NOT NULL
    ),
    type_counts AS (
      SELECT "sourceType", COUNT(*)::bigint as count
      FROM eligible_group_content
      GROUP BY "sourceType"
    )
    SELECT "sourceType"::text as "sourceType", count, NULL::bigint as "mergedTotal"
    FROM type_counts
    UNION ALL
    SELECT NULL::text as "sourceType", NULL::bigint as count, COUNT(DISTINCT content_hash)::bigint as "mergedTotal"
    FROM eligible_group_content
    ORDER BY count DESC NULLS LAST
  `;

  let mergedTotal = 0;
  const typeCounts: TypeCount[] = [];

  for (const row of rows) {
    if (row.sourceType) {
      typeCounts.push({
        sourceType: row.sourceType as SourceType,
        count: Number(row.count ?? 0n),
      });
    } else {
      mergedTotal = Number(row.mergedTotal ?? 0n);
    }
  }

  return { typeCounts, mergedTotal };
}

/**
 * Count merged (content-hash collapsed) groups with 2+ members matching the given filter.
 * The where clause is expected to include the cached member eligibility predicate.
 */
async function countMergedGroups(prisma: PrismaClient, whereClause: Prisma.Sql): Promise<number> {
  const [{ count }] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(DISTINCT g."memberHash")::bigint as count
    FROM "Group" g
    LEFT JOIN "ContentTranslation" ct ON g."titleHash" = ct."contentHash"
    ${whereClause}
  `;
  return Number(count);
}

async function getRandomContentHashes({
  prisma,
  whereClause,
  seed,
  offset,
  pageSize,
}: {
  prisma: PrismaClient;
  whereClause: Prisma.Sql;
  seed: string;
  offset: number;
  pageSize: number;
}): Promise<string[]> {
  if (pageSize <= 0) {
    return [];
  }

  const cursor = seedToHexCursor(seed, 32);
  const firstRows = await prisma.$queryRaw<Array<{ contentHash: string }>>`
    WITH filtered_hashes AS (
      SELECT DISTINCT g."memberHash" AS content_hash
      FROM "Group" g
      LEFT JOIN "ContentTranslation" ct ON g."titleHash" = ct."contentHash"
      ${whereClause}
    )
    SELECT content_hash AS "contentHash"
    FROM filtered_hashes
    WHERE content_hash >= ${cursor}
    ORDER BY content_hash ASC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const pageHashes = firstRows.map((row) => row.contentHash);
  if (pageHashes.length >= pageSize) {
    return pageHashes;
  }

  let wrapOffset = 0;
  if (pageHashes.length === 0 && offset > 0) {
    const [{ count }] = await prisma.$queryRaw<Array<{ count: bigint }>>`
      WITH filtered_hashes AS (
        SELECT DISTINCT g."memberHash" AS content_hash
        FROM "Group" g
        LEFT JOIN "ContentTranslation" ct ON g."titleHash" = ct."contentHash"
        ${whereClause}
      )
      SELECT COUNT(*)::bigint as count
      FROM filtered_hashes
      WHERE content_hash >= ${cursor}
    `;
    wrapOffset = Math.max(0, offset - Number(count));
  }

  const wrappedRows = await prisma.$queryRaw<Array<{ contentHash: string }>>`
    WITH filtered_hashes AS (
      SELECT DISTINCT g."memberHash" AS content_hash
      FROM "Group" g
      LEFT JOIN "ContentTranslation" ct ON g."titleHash" = ct."contentHash"
      ${whereClause}
    )
    SELECT content_hash AS "contentHash"
    FROM filtered_hashes
    WHERE content_hash < ${cursor}
    ORDER BY content_hash ASC
    LIMIT ${pageSize - pageHashes.length} OFFSET ${wrapOffset}
  `;

  return [...pageHashes, ...wrappedRows.map((row) => row.contentHash)];
}

async function getGroupsByContentHashes({
  prisma,
  whereClause,
  contentHashes,
}: {
  prisma: PrismaClient;
  whereClause: Prisma.Sql;
  contentHashes: string[];
}): Promise<Array<{
  contentHash: string;
  groupIds: number[];
  sourceTypes: string[];
  sourceIds: string[];
  titles: (string | null)[];
  translatedTitles: (string | null)[];
  postCount: bigint;
  filteredCount: bigint;
}>> {
  if (contentHashes.length === 0) {
    return [];
  }

  return prisma.$queryRaw`
    WITH selected_hashes AS (
      SELECT hash, ord
      FROM unnest(${contentHashes}::text[]) WITH ORDINALITY AS selected(hash, ord)
    ),
    group_content AS (
      SELECT
        selected_hashes.ord,
        g.id as group_id,
        g."sourceType",
        g."sourceId",
        g."title",
        ct."translatedContent" as translated_title,
        g."memberHash" as content_hash,
        g."memberCount"::bigint as post_count
      FROM selected_hashes
      JOIN "Group" g ON g."memberHash" = selected_hashes.hash::char(32)
      LEFT JOIN "ContentTranslation" ct ON g."titleHash" = ct."contentHash"
      ${whereClause}
    )
    SELECT
      content_hash as "contentHash",
      ARRAY_AGG(group_id ORDER BY group_id) as "groupIds",
      ARRAY_AGG("sourceType"::text ORDER BY group_id) as "sourceTypes",
      ARRAY_AGG("sourceId" ORDER BY group_id) as "sourceIds",
      ARRAY_AGG("title" ORDER BY group_id) as "titles",
      ARRAY_AGG(translated_title ORDER BY group_id) as "translatedTitles",
      MAX(post_count) as "postCount",
      0::bigint as "filteredCount"
    FROM group_content
    GROUP BY ord, content_hash
    ORDER BY ord ASC
  `;
}

function normalizeTextFilter(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function containsPattern(value: string): string {
  return `%${escapeSqlLike(value)}%`;
}

function validCreatorSqlPredicate(nameExpression: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`${nameExpression} !~ ${NUMERIC_CREATOR_SQL_PATTERN} AND ${nameExpression} !~* ${PIXIV_USER_SQL_PATTERN}`;
}

/**
 * Uncorrelated subquery of group ids that have a valid ARTIST tag matching
 * `pattern`. Anchored on `Tag` so the name ILIKE uses the trigram index.
 */
function artistMatchGroupIds(pattern: string): Prisma.Sql {
  return Prisma.sql`
    SELECT artist_pg."groupId"
    FROM "Tag" artist_t
    JOIN "PostTag" artist_pt ON artist_pt."tagId" = artist_t.id
    JOIN "PostGroup" artist_pg ON artist_pg."postId" = artist_pt."postId"
    WHERE artist_t.category = 'ARTIST'::"TagCategory"
      AND artist_t.name ILIKE ${pattern}
      AND ${validCreatorSqlPredicate(Prisma.sql`artist_t.name`)}
  `;
}

/**
 * Pre-resolved text/creator filter matches. A filtered request evaluates the
 * where clause in up to five queries (stats, count, page hashes, hash wrap,
 * group hydration); resolving the expensive match sets ONCE per request and
 * passing them as id arrays keeps those queries to cheap `id = ANY(...)`
 * probes instead of re-running ILIKE scans and the artist tag fan-out join.
 * `undefined` = filter not active; an empty array matches nothing.
 */
interface ResolvedGroupFilters {
  queryMatchIds?: number[];
  creatorMatchIds?: number[];
}

async function resolveGroupFilterIds(
  prisma: PrismaClient,
  { query, creatorFilter }: Pick<GroupsSearchParams, "query" | "creatorFilter">
): Promise<ResolvedGroupFilters> {
  const normalizedQuery = normalizeTextFilter(query);
  const normalizedCreatorFilter = normalizeTextFilter(creatorFilter);
  const queryPattern = normalizedQuery ? containsPattern(normalizedQuery) : undefined;
  const creatorPattern = normalizedCreatorFilter ? containsPattern(normalizedCreatorFilter) : undefined;

  const queryIdsPromise = queryPattern
    ? prisma.$queryRaw<Array<{ id: number }>>`
        SELECT tg.id
        FROM "Group" tg
        WHERE tg."sourceId" ILIKE ${queryPattern}
           OR tg.title ILIKE ${queryPattern}
        UNION
        SELECT tg2.id
        FROM "Group" tg2
        JOIN "ContentTranslation" tct ON tg2."titleHash" = tct."contentHash"
        WHERE tct."translatedContent" ILIKE ${queryPattern}
        UNION
        ${artistMatchGroupIds(queryPattern)}
      `
    : Promise.resolve(undefined);

  const creatorIdsPromise = creatorPattern
    ? prisma.$queryRaw<Array<{ id: number }>>`
        SELECT DISTINCT match."groupId" AS id
        FROM (${artistMatchGroupIds(creatorPattern)}) AS match
      `
    : Promise.resolve(undefined);

  const [queryRows, creatorRows] = await Promise.all([queryIdsPromise, creatorIdsPromise]);

  return {
    queryMatchIds: queryRows?.map((row) => row.id),
    creatorMatchIds: creatorRows?.map((row) => row.id),
  };
}

function buildGroupsWhereClause(
  typeFilter: SourceType | undefined,
  resolved: ResolvedGroupFilters
): Prisma.Sql {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`g."memberCount" >= 2`,
    Prisma.sql`g."memberHash" IS NOT NULL`,
  ];

  if (typeFilter) {
    conditions.push(Prisma.sql`g."sourceType" = ${typeFilter}::"SourceType"`);
  }

  if (resolved.queryMatchIds !== undefined) {
    conditions.push(Prisma.sql`g.id = ANY(${resolved.queryMatchIds}::int[])`);
  }

  if (resolved.creatorMatchIds !== undefined) {
    conditions.push(Prisma.sql`g.id = ANY(${resolved.creatorMatchIds}::int[])`);
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
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
    query,
    creatorFilter,
    order = "random",
    page = 1,
    pageSize = 50,
    seed = "",
  } = params;

  const offset = (page - 1) * pageSize;

  const orderClause = {
    newest: Prisma.sql`ORDER BY min_group_id DESC`,
    oldest: Prisma.sql`ORDER BY min_group_id ASC`,
    largest: Prisma.sql`ORDER BY max_post_count DESC, min_group_id DESC`,
    random: Prisma.sql`ORDER BY content_hash ASC`,
  }[order];
  const isFiltered = Boolean(
    typeFilter || normalizeTextFilter(query) || normalizeTextFilter(creatorFilter)
  );
  // Kick off the filter-independent stats query BEFORE awaiting the filter
  // resolver so the two overlap; every remaining query needs the resolved
  // where clause.
  const listStatsPromise: Promise<GroupListStats> = isFiltered
    ? getGroupListStats(prisma)
    : getGroupTypeCounts(prisma).then((typeCounts) => ({
        typeCounts,
        mergedTotal: 0,
      }));
  const resolvedFilters = await resolveGroupFilterIds(prisma, { query, creatorFilter });
  const whereClause = buildGroupsWhereClause(typeFilter, resolvedFilters);

  const filteredCountPromise = order === "random"
    ? countMergedGroups(prisma, whereClause)
    : Promise.resolve(0);

  // Get merged groups - groups with identical posts are combined
  const mergedGroupsPromise: Promise<Array<{
    contentHash: string;
    groupIds: number[];
    sourceTypes: string[];
    sourceIds: string[];
    titles: (string | null)[];
    translatedTitles: (string | null)[];
    postCount: bigint;
    filteredCount: bigint;
  }>> = order === "random"
    ? getRandomContentHashes({
        prisma,
        whereClause,
        seed,
        offset,
        pageSize,
      }).then((contentHashes) => getGroupsByContentHashes({
        prisma,
        whereClause,
        contentHashes,
      }))
    : prisma.$queryRaw`
    WITH group_content AS (
      SELECT
        g.id as group_id,
        g."sourceType",
        g."sourceId",
        g."title",
        ct."translatedContent" as translated_title,
        g."memberHash" as content_hash,
        g."memberCount"::bigint as post_count
      FROM "Group" g
      LEFT JOIN "ContentTranslation" ct ON g."titleHash" = ct."contentHash"
      ${whereClause}
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

  const [listStats, mergedGroupsRaw, randomFilteredCount] = await Promise.all([
    listStatsPromise,
    mergedGroupsPromise,
    filteredCountPromise,
  ]);
  const { typeCounts, mergedTotal: unfilteredMergedTotal } = listStats;
  const totalGroups = typeCounts.reduce((sum, t) => sum + t.count, 0);

  const representativeGroupIds = mergedGroupsRaw.map((group) => group.groupIds[0]);
  const groupPostsPromise: Promise<Array<{
    postId: number;
    groupId: number;
    position: number;
    id: number;
    hash: string;
    width: number | null;
    height: number | null;
  }>> = representativeGroupIds.length > 0 ? prisma.$queryRaw<{
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
  ` : Promise.resolve([]);

  const artistTagsPromise: Promise<Array<{
    groupId: number;
    name: string;
    postCount: number;
  }>> = representativeGroupIds.length > 0 ? prisma.$queryRaw<{
    groupId: number;
    name: string;
    postCount: number;
  }[]>`
    SELECT pg."groupId", t.name, MAX(t."postCount")::int AS "postCount"
    FROM "PostGroup" pg
    JOIN "PostTag" pt ON pt."postId" = pg."postId"
    JOIN "Tag" t ON t.id = pt."tagId"
    WHERE pg."groupId" = ANY(${representativeGroupIds}::int[])
      AND t.category = 'ARTIST'::"TagCategory"
    GROUP BY pg."groupId", t.name
    ORDER BY pg."groupId" ASC, "postCount" DESC, t.name ASC
  ` : Promise.resolve([]);

  const [groupPostsRaw, artistTagsRaw] = await Promise.all([
    groupPostsPromise,
    artistTagsPromise,
  ]);

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

  // Group artist tags by representative groupId
  const artistsByGroup = new Map<number, string[]>();
  for (const row of artistTagsRaw) {
    const existing = artistsByGroup.get(row.groupId) || [];
    existing.push(row.name);
    artistsByGroup.set(row.groupId, existing);
  }

  // Combine data
  const groups: MergedGroup[] = mergedGroupsRaw.map(g => {
    const posts = (postsByGroup.get(g.groupIds[0]) || []).slice(0, 10);

    // Collect unique creators from all posts in this representative group
    const creatorSet = new Set<string>();
    for (const artist of artistsByGroup.get(g.groupIds[0]) || []) {
      if (isValidCreatorName(artist)) {
        creatorSet.add(artist);
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

  let filteredCount = order === "random"
    ? randomFilteredCount
    : Number(mergedGroupsRaw[0]?.filteredCount ?? 0n);
  if (filteredCount === 0 && offset > 0) {
    // Window function returns no rows past the last page; recount directly.
    filteredCount = await countMergedGroups(prisma, whereClause);
  }

  // filteredCount and the unfiltered total come from separate queries; a concurrent sync
  // between them could otherwise yield mergedTotal < filteredCount ("47 of 45"). Clamp so the
  // denominator is never smaller than the numerator.
  const mergedTotal = isFiltered
    ? Math.max(unfilteredMergedTotal, filteredCount)
    : filteredCount;

  const totalPages = Math.ceil(filteredCount / pageSize);

  return {
    groups,
    typeCounts,
    totalGroups,
    mergedTotal,
    filteredCount,
    totalPages,
    page,
  };
}
