/**
 * Search functionality for posts and notes.
 *
 * This module provides two main search capabilities:
 * - `searchNotes`: Full-text search across note content and translations
 * - `searchPosts`: Tag-based search with wildcard and negation support
 *
 * @module lib/search
 */

import DOMPurify from "isomorphic-dompurify";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import {
  isWildcardPattern,
  validateWildcardPattern,
  parseTagsWithNegation,
  resolveWildcardPattern,
  ResolvedWildcard,
} from "@/lib/wildcard";
import { isTagBlacklisted, withPostHidingFilter, getPostHidingSqlCondition } from "@/lib/tag-blacklist";
import {
  separateMetaTags,
  getMetaTagDefinition,
  requiresRawSql,
  getOrientationSqlCondition,
} from "@/lib/meta-tags";

/** Number of results per page for paginated searches */
const POSTS_PER_PAGE = 48;

/**
 * Minimal post data returned in search results.
 * Contains only fields needed for rendering thumbnails and links.
 */
export interface PostResult {
  id: number;
  hash: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  mimeType: string;
}

/**
 * Note search result with associated post data.
 * Notes with identical content share the same `contentHash`,
 * which can be used for client-side grouping/deduplication.
 */
export interface NoteResult {
  id: number;
  postId: number;
  /** Note label/title from Hydrus */
  name: string;
  /** Original note text content */
  content: string;
  /** SHA256 hash of content, used for translation deduplication */
  contentHash: string;
  /** Search result snippet with <mark> tags highlighting matches */
  headline: string | null;
  post: PostResult;
}

/** Common fields for paginated search results */
interface BaseSearchResult {
  totalCount: number;
  totalPages: number;
  queryTimeMs: number;
  error?: string;
}

/** Result of searching posts by tags */
export interface TagSearchResult extends BaseSearchResult {
  posts: PostResult[];
  /** Wildcard patterns that were expanded, with their matched tags */
  resolvedWildcards: ResolvedWildcard[];
}

/** Result of searching notes by content */
export interface NoteSearchResult extends BaseSearchResult {
  notes: NoteResult[];
}

/**
 * Sanitize headline HTML from PostgreSQL ts_headline.
 * Only allows <mark> tags for search term highlighting.
 */
function sanitizeHeadline(headline: string | null): string | null {
  if (!headline) return null;
  return DOMPurify.sanitize(headline, { ALLOWED_TAGS: ["mark"] });
}

/**
 * Adjust headline highlighting to only mark the matched prefix, not the full word.
 * e.g., searching "back" in "background" → "<mark>back</mark>ground" instead of "<mark>background</mark>"
 */
function adjustPrefixHighlighting(headline: string | null, query: string): string | null {
  if (!headline) return null;

  // Extract search terms from query (ignore operators, quotes)
  const terms = query
    .toLowerCase()
    .replace(/["()-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && t !== "or");

  if (terms.length === 0) return headline;

  // Replace each <mark>word</mark> with prefix-only highlighting
  return headline.replace(/<mark>([^<]+)<\/mark>/gi, (match, word: string) => {
    const wordLower = word.toLowerCase();

    // Find which search term matches as prefix
    for (const term of terms) {
      if (wordLower.startsWith(term)) {
        const prefixLen = term.length;
        const prefix = word.slice(0, prefixLen);
        const rest = word.slice(prefixLen);
        return `<mark>${prefix}</mark>${rest}`;
      }
    }

    // No prefix match found (exact match or other), keep as-is
    return match;
  });
}

/**
 * Search notes by content using PostgreSQL full-text search.
 *
 * Searches both original note content and translations (via NoteTranslation table).
 * Results are ranked using `ts_rank_cd` (cover density) which prioritizes
 * results where search terms appear closer together.
 *
 * Search syntax (via `websearch_to_tsquery`):
 * - Multiple words: AND by default ("hello world" matches notes with both)
 * - Quoted phrases: exact sequence ("hello world" as phrase)
 * - OR: alternative terms (hello OR world)
 * - Minus: exclusions (hello -world)
 *
 * @param query - Search query (minimum 2 characters)
 * @param page - Page number (1-indexed)
 * @returns Paginated notes with highlighted snippets and post data
 */
export async function searchNotes(query: string, page: number): Promise<NoteSearchResult> {
  if (!query || query.trim().length < 2) {
    return { notes: [], totalCount: 0, totalPages: 0, queryTimeMs: 0 };
  }

  const skip = (page - 1) * POSTS_PER_PAGE;
  const startTime = performance.now();
  const postHidingCondition = getPostHidingSqlCondition('p.id');

  try {
    // CTE to compute tsquery with prefix matching
    // Uses websearch_to_tsquery for parsing (supports quotes, OR, -)
    // Then converts each lexeme to prefix match (e.g., 'back' → 'back':* matches 'background')
    // UNION allows each subquery to use its own GIN index efficiently
    // Count using window function
    const results = await prisma.$queryRaw<(NoteResult & { total_count: bigint })[]>`
      WITH
        query AS (
          SELECT regexp_replace(
            websearch_to_tsquery('simple', ${query})::text,
            '''([^'']+)''',
            '''\\1'':*',
            'g'
          )::tsquery AS q
        ),
        matches AS (
          -- Match in note content (uses Note_contentTsv_idx GIN index)
          SELECT DISTINCT ON (n.id)
            n.id,
            n."postId",
            n.name,
            n.content,
            n."contentHash",
            n."contentTsv",
            ts_rank_cd(n."contentTsv", q.q) AS rank,
            ts_headline('simple', n.content, q.q,
              'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20, MaxFragments=2') AS headline,
            p.id AS post_id,
            p.hash AS post_hash,
            p.width AS post_width,
            p.height AS post_height,
            p.blurhash AS post_blurhash,
            p."mimeType" AS post_mime,
            p."importedAt" AS imported_at
          FROM "Note" n
          CROSS JOIN query q
          JOIN "Post" p ON n."postId" = p.id
          WHERE n."contentTsv" @@ q.q
            AND ${postHidingCondition}

          UNION

          -- Match in translation content (uses NoteTranslation_translatedTsv_idx GIN index)
          SELECT DISTINCT ON (n.id)
            n.id,
            n."postId",
            n.name,
            n.content,
            n."contentHash",
            n."contentTsv",
            ts_rank_cd(nt."translatedTsv", q.q) AS rank,
            ts_headline('simple', nt."translatedContent", q.q,
              'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20, MaxFragments=2') AS headline,
            p.id AS post_id,
            p.hash AS post_hash,
            p.width AS post_width,
            p.height AS post_height,
            p.blurhash AS post_blurhash,
            p."mimeType" AS post_mime,
            p."importedAt" AS imported_at
          FROM "Note" n
          CROSS JOIN query q
          JOIN "Post" p ON n."postId" = p.id
          JOIN "NoteTranslation" nt ON n."contentHash" = nt."contentHash"
          WHERE nt."translatedTsv" @@ q.q
            AND ${postHidingCondition}
        ),
        deduplicated AS (
          -- Deduplicate notes that match in both content and translation, keeping highest rank
          SELECT DISTINCT ON (id)
            id, "postId", name, content, "contentHash", headline,
            post_id, post_hash, post_width, post_height, post_blurhash, post_mime,
            rank, imported_at
          FROM matches
          ORDER BY id, rank DESC
        ),
        counted AS (
          SELECT *, COUNT(*) OVER() AS total_count
          FROM deduplicated
          ORDER BY rank DESC, imported_at DESC
          LIMIT ${POSTS_PER_PAGE} OFFSET ${skip}
        )
      SELECT
        id,
        "postId",
        name,
        content,
        "contentHash",
        headline,
        jsonb_build_object(
          'id', post_id, 'hash', post_hash, 'width', post_width, 'height', post_height,
          'blurhash', post_blurhash, 'mimeType', post_mime
        ) AS post,
        total_count
      FROM counted
    `;

    const totalCount = results.length > 0 ? Number(results[0].total_count) : 0;

    return {
      notes: results.map((n) => ({
        id: n.id,
        postId: n.postId,
        name: n.name,
        content: n.content,
        contentHash: n.contentHash,
        headline: adjustPrefixHighlighting(sanitizeHeadline(n.headline), query),
        post: n.post as PostResult,
      })),
      totalCount,
      totalPages: Math.ceil(totalCount / POSTS_PER_PAGE),
      queryTimeMs: performance.now() - startTime,
    };
  } catch (err) {
    console.error("Notes search error:", err);
    return { notes: [], totalCount: 0, totalPages: 0, queryTimeMs: 0, error: "Failed to search notes" };
  }
}

/**
 * Search posts by tags with wildcard, negation, and meta tag support.
 *
 * Supports complex tag queries:
 * - Regular tags: exact match (case-insensitive)
 * - Wildcards: `*` matches any characters (e.g., `artist:*`, `*_hair`)
 * - Negation: prefix with `-` to exclude (e.g., `-solo`, `-artist:*`)
 * - Meta tags: computed filters based on file properties (e.g., `video`, `portrait`, `highres`)
 *
 * All included tags are ANDed together (posts must have all of them).
 * Excluded tags filter out any posts containing them.
 *
 * @param tags - Array of tag names, optionally prefixed with `-` for negation
 * @param page - Page number (1-indexed)
 * @returns Paginated posts with resolved wildcard information
 */
export async function searchPosts(tags: string[], page: number): Promise<TagSearchResult> {
  const skip = (page - 1) * POSTS_PER_PAGE;

  // First, separate meta tags from regular tags
  const { metaTags, regularTags: separatedRegular } = separateMetaTags(tags);

  // Combine regular tags back into include/exclude format for existing processing
  const allRegularTags = [
    ...separatedRegular.include,
    ...separatedRegular.exclude.map((t) => `-${t}`),
  ];

  const { includeTags: rawIncludeTags, excludeTags: rawExcludeTags } = parseTagsWithNegation(allRegularTags);

  // Filter out blacklisted tags from input - users should not be able to search using blacklisted tags
  // For wildcards, we check if the pattern itself is blacklisted (e.g., "hydl-import-time:*")
  const includeTags = rawIncludeTags.filter(tag => !isTagBlacklisted(tag));
  const excludeTags = rawExcludeTags.filter(tag => !isTagBlacklisted(tag));

  // Check if we have any search criteria (tags or meta tags)
  const hasMetaTags = metaTags.include.length > 0 || metaTags.exclude.length > 0;
  if (includeTags.length === 0 && excludeTags.length === 0 && !hasMetaTags) {
    return { posts: [], totalPages: 0, totalCount: 0, queryTimeMs: 0, resolvedWildcards: [] };
  }

  // Categorize regular tags into regular and wildcard
  const regular = { include: [] as string[], exclude: [] as string[] };
  const wildcard = { include: [] as string[], exclude: [] as string[] };
  const errors: string[] = [];

  for (const tag of includeTags) {
    if (isWildcardPattern(tag)) {
      const v = validateWildcardPattern(tag);
      v.valid ? wildcard.include.push(tag) : errors.push(v.error ?? "Invalid pattern");
    } else {
      regular.include.push(tag);
    }
  }

  for (const tag of excludeTags) {
    if (isWildcardPattern(tag)) {
      const v = validateWildcardPattern(`-${tag}`);
      v.valid ? wildcard.exclude.push(tag) : errors.push(v.error ?? "Invalid pattern");
    } else {
      regular.exclude.push(tag);
    }
  }

  if (errors.length > 0) {
    return { posts: [], totalPages: 0, totalCount: 0, queryTimeMs: 0, resolvedWildcards: [], error: errors[0] };
  }

  // Resolve wildcards
  const resolvedWildcards: ResolvedWildcard[] = [];
  const includeWildcardIds: number[][] = [];
  const excludeWildcardIds: number[] = [];

  for (const pattern of wildcard.include) {
    const r = await resolveWildcardPattern(pattern, "page");
    includeWildcardIds.push(r.tagIds);
    resolvedWildcards.push({ pattern, negated: false, ...r });
  }

  for (const pattern of wildcard.exclude) {
    const r = await resolveWildcardPattern(pattern, "page");
    excludeWildcardIds.push(...r.tagIds);
    resolvedWildcards.push({ pattern: `-${pattern}`, negated: true, ...r });
  }

  // Build Prisma where clause
  const conditions: object[] = [];

  // Add regular tag conditions
  for (const name of regular.include) {
    conditions.push({ tags: { some: { tag: { name: { equals: name, mode: "insensitive" as const } } } } });
  }

  for (const ids of includeWildcardIds) {
    if (ids.length === 0) {
      return { posts: [], totalPages: 0, totalCount: 0, queryTimeMs: 0, resolvedWildcards };
    }
    conditions.push({ tags: { some: { tagId: { in: ids } } } });
  }

  for (const name of regular.exclude) {
    conditions.push({ tags: { none: { tag: { name: { equals: name, mode: "insensitive" as const } } } } });
  }

  if (excludeWildcardIds.length > 0) {
    conditions.push({ tags: { none: { tagId: { in: excludeWildcardIds } } } });
  }

  // Add meta tag conditions (non-orientation)
  for (const metaName of metaTags.include) {
    if (!requiresRawSql(metaName)) {
      const def = getMetaTagDefinition(metaName);
      if (def?.getCondition) {
        conditions.push(def.getCondition());
      }
    }
  }

  for (const metaName of metaTags.exclude) {
    if (!requiresRawSql(metaName)) {
      const def = getMetaTagDefinition(metaName);
      if (def?.getCondition) {
        conditions.push({ NOT: def.getCondition() });
      }
    }
  }

  // Check for orientation meta tags that require raw SQL
  const orientationInclude = metaTags.include.filter(requiresRawSql);
  const orientationExclude = metaTags.exclude.filter(requiresRawSql);
  const hasOrientationTags = orientationInclude.length > 0 || orientationExclude.length > 0;

  // Build orientation SQL conditions
  // For orientation (portrait/landscape/square), we use raw SQL since Prisma
  // doesn't support field-to-field comparisons. The query uses a simple WHERE clause
  // with the orientation condition - PostgreSQL will use indexes efficiently.
  let orientationSqlCondition: Prisma.Sql | null = null;
  if (hasOrientationTags) {
    const orientationConditions: Prisma.Sql[] = [];

    for (const metaName of orientationInclude) {
      orientationConditions.push(getOrientationSqlCondition(metaName, false));
    }

    for (const metaName of orientationExclude) {
      orientationConditions.push(getOrientationSqlCondition(metaName, true));
    }

    orientationSqlCondition = orientationConditions.length > 1
      ? Prisma.sql`(${Prisma.join(orientationConditions, " AND ")})`
      : orientationConditions[0];
  }

  const baseWhere = conditions.length > 0 ? { AND: conditions } : {};
  const where = withPostHidingFilter(baseWhere);

  const startTime = performance.now();

  // If orientation tags are present, use optimized raw SQL query
  if (orientationSqlCondition) {
    // For orientation-only queries (no tag filters), use simple raw SQL
    const hasTagFilters = regular.include.length > 0 || regular.exclude.length > 0 ||
                          includeWildcardIds.length > 0 || excludeWildcardIds.length > 0;

    if (!hasTagFilters) {
      // Simple orientation query - very efficient with proper indexing
      const postHidingCondition = getPostHidingSqlCondition('p.id');

      const [posts, countResult] = await Promise.all([
        prisma.$queryRaw<PostResult[]>`
          SELECT p.id, p.hash, p.width, p.height, p.blurhash, p."mimeType"
          FROM "Post" p
          WHERE ${orientationSqlCondition}
            AND ${postHidingCondition}
          ORDER BY p."importedAt" DESC
          LIMIT ${POSTS_PER_PAGE} OFFSET ${skip}
        `,
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*)::bigint as count
          FROM "Post" p
          WHERE ${orientationSqlCondition}
            AND ${postHidingCondition}
        `,
      ]);

      return {
        posts,
        totalPages: Math.ceil(Number(countResult[0]?.count ?? 0) / POSTS_PER_PAGE),
        totalCount: Number(countResult[0]?.count ?? 0),
        queryTimeMs: performance.now() - startTime,
        resolvedWildcards,
      };
    }

    // For orientation + tag filters, get IDs of posts matching orientation
    // Then use Prisma to apply tag filters on that subset
    const postHidingCondition = getPostHidingSqlCondition('p.id');

    // Limit orientation results to prevent memory issues on large databases
    // 50,000 is a reasonable limit that balances performance and functionality
    const MAX_ORIENTATION_IDS = 50000;

    const orientationPosts = await prisma.$queryRaw<{ id: number }[]>`
      SELECT p.id FROM "Post" p
      WHERE ${orientationSqlCondition}
        AND ${postHidingCondition}
      ORDER BY p."importedAt" DESC
      LIMIT ${MAX_ORIENTATION_IDS}
    `;

    if (orientationPosts.length === 0) {
      return { posts: [], totalPages: 0, totalCount: 0, queryTimeMs: performance.now() - startTime, resolvedWildcards };
    }

    const orientationPostIds = orientationPosts.map(p => p.id);

    // Now use Prisma to filter by tags within the orientation-matching posts
    const filteredWhere = withPostHidingFilter({
      AND: [
        { id: { in: orientationPostIds } },
        ...conditions,
      ],
    });

    const [filteredPosts, filteredCount] = await Promise.all([
      prisma.post.findMany({
        where: filteredWhere,
        orderBy: { importedAt: "desc" },
        skip,
        take: POSTS_PER_PAGE,
        select: { id: true, hash: true, width: true, height: true, blurhash: true, mimeType: true },
      }),
      prisma.post.count({ where: filteredWhere }),
    ]);

    return {
      posts: filteredPosts,
      totalPages: Math.ceil(filteredCount / POSTS_PER_PAGE),
      totalCount: filteredCount,
      queryTimeMs: performance.now() - startTime,
      resolvedWildcards,
    };
  }

  // Standard Prisma query for non-orientation searches
  const [posts, totalCount] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { importedAt: "desc" },
      skip,
      take: POSTS_PER_PAGE,
      select: { id: true, hash: true, width: true, height: true, blurhash: true, mimeType: true },
    }),
    prisma.post.count({ where }),
  ]);

  return {
    posts,
    totalPages: Math.ceil(totalCount / POSTS_PER_PAGE),
    totalCount,
    queryTimeMs: performance.now() - startTime,
    resolvedWildcards,
  };
}
