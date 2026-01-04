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
import {
  isWildcardPattern,
  validateWildcardPattern,
  resolveWildcardPattern,
  ResolvedWildcard,
} from "@/lib/wildcard";
import { isTagBlacklisted, withPostHidingFilter, getPostHidingSqlCondition } from "@/lib/tag-blacklist";
import { separateMetaTags, getMetaTagDefinition } from "@/lib/meta-tags";

/** Default number of results per page */
const DEFAULT_LIMIT = 48;
/** Maximum allowed results per page */
const MAX_LIMIT = 100;
/** Maximum page number to prevent expensive offset queries */
const MAX_PAGE = 10000;

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

/** Type of search result - either a note or a group title */
export type NoteResultType = "note" | "group";

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
  /** Type of result - 'note' for actual notes, 'group' for group title matches */
  resultType: NoteResultType;
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

/** Options for post search */
export interface SearchPostsOptions {
  /** Results per page (default 48, max 100) */
  limit?: number;
  /** Search query for note content (min 2 chars, uses fulltext search) */
  notesQuery?: string;
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
 * Searches both original note content and translations (via ContentTranslation table).
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

  const skip = (page - 1) * DEFAULT_LIMIT;
  const startTime = performance.now();
  const postHidingCondition = getPostHidingSqlCondition('p.id');
  const groupPostHidingCondition = getPostHidingSqlCondition('first_post.id');

  try {
    // CTE to compute tsquery with prefix matching
    // Uses websearch_to_tsquery for parsing (supports quotes, OR, -)
    // Then converts each lexeme to prefix match (e.g., 'back' → 'back':* matches 'background')
    // UNION allows each subquery to use its own GIN index efficiently
    // Count using window function
    // Also searches group titles (original and translated)
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
            'note' AS result_type,
            n."postId",
            n.name,
            n.content,
            n."contentHash",
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

          -- Match in note translation content (uses ContentTranslation_translatedTsv_idx GIN index)
          SELECT DISTINCT ON (n.id)
            n.id,
            'note' AS result_type,
            n."postId",
            n.name,
            n.content,
            n."contentHash",
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
          JOIN "ContentTranslation" nt ON n."contentHash" = nt."contentHash"
          WHERE nt."translatedTsv" @@ q.q
            AND ${postHidingCondition}

          UNION

          -- Match in group title
          SELECT DISTINCT ON (g.id)
            g.id,
            'group' AS result_type,
            first_post.id AS "postId",
            'Group Title' AS name,
            g.title AS content,
            g."titleHash" AS "contentHash",
            ts_rank_cd(g."titleTsv", q.q) AS rank,
            ts_headline('simple', g.title, q.q,
              'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20, MaxFragments=2') AS headline,
            first_post.id AS post_id,
            first_post.hash AS post_hash,
            first_post.width AS post_width,
            first_post.height AS post_height,
            first_post.blurhash AS post_blurhash,
            first_post."mimeType" AS post_mime,
            first_post."importedAt" AS imported_at
          FROM "Group" g
          CROSS JOIN query q
          JOIN "PostGroup" pg ON g.id = pg."groupId"
          JOIN "Post" first_post ON pg."postId" = first_post.id AND pg.position = 0
          WHERE g."titleTsv" @@ q.q
            AND ${groupPostHidingCondition}

          UNION

          -- Match in group title translation
          SELECT DISTINCT ON (g.id)
            g.id,
            'group' AS result_type,
            first_post.id AS "postId",
            'Group Title' AS name,
            g.title AS content,
            g."titleHash" AS "contentHash",
            ts_rank_cd(ct."translatedTsv", q.q) AS rank,
            ts_headline('simple', ct."translatedContent", q.q,
              'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20, MaxFragments=2') AS headline,
            first_post.id AS post_id,
            first_post.hash AS post_hash,
            first_post.width AS post_width,
            first_post.height AS post_height,
            first_post.blurhash AS post_blurhash,
            first_post."mimeType" AS post_mime,
            first_post."importedAt" AS imported_at
          FROM "Group" g
          CROSS JOIN query q
          JOIN "ContentTranslation" ct ON g."titleHash" = ct."contentHash"
          JOIN "PostGroup" pg ON g.id = pg."groupId"
          JOIN "Post" first_post ON pg."postId" = first_post.id AND pg.position = 0
          WHERE ct."translatedTsv" @@ q.q
            AND ${groupPostHidingCondition}
        ),
        deduplicated AS (
          -- Deduplicate matches, keeping highest rank (per result_type + id combination)
          SELECT DISTINCT ON (result_type, id)
            id, result_type, "postId", name, content, "contentHash", headline,
            post_id, post_hash, post_width, post_height, post_blurhash, post_mime,
            rank, imported_at
          FROM matches
          ORDER BY result_type, id, rank DESC
        ),
        counted AS (
          SELECT *, COUNT(*) OVER() AS total_count
          FROM deduplicated
          ORDER BY rank DESC, imported_at DESC
          LIMIT ${DEFAULT_LIMIT} OFFSET ${skip}
        )
      SELECT
        id,
        result_type AS "resultType",
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
        resultType: n.resultType as NoteResultType,
        post: n.post as PostResult,
      })),
      totalCount,
      totalPages: Math.ceil(totalCount / DEFAULT_LIMIT),
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
 * @param page - Page number (1-indexed, max 10000)
 * @param options - Optional search configuration
 * @returns Paginated posts with resolved wildcard information
 */
export async function searchPosts(
  tags: string[],
  page: number,
  options?: SearchPostsOptions
): Promise<TagSearchResult> {
  // Validate and apply limits
  const limit = Math.min(Math.max(1, options?.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
  const validatedPage = Math.min(Math.max(1, page), MAX_PAGE);
  const skip = (validatedPage - 1) * limit;

  // Early return if page exceeds maximum
  if (page > MAX_PAGE) {
    return { posts: [], totalPages: 0, totalCount: 0, queryTimeMs: 0, resolvedWildcards: [] };
  }

  const notesQuery = options?.notesQuery?.trim() ?? "";
  const hasNotesFilter = notesQuery.length >= 2;

  // Separate meta tags from regular tags (also handles negation parsing)
  const { metaTags, regularTags } = separateMetaTags(tags);

  // Filter out blacklisted tags from input - users should not be able to search using blacklisted tags
  // For wildcards, we check if the pattern itself is blacklisted (e.g., "hydl-import-time:*")
  const includeTags = regularTags.include.filter(tag => !isTagBlacklisted(tag));
  const excludeTags = regularTags.exclude.filter(tag => !isTagBlacklisted(tag));

  // Check if we have any search criteria (tags, meta tags, or notes)
  const hasMetaTags = metaTags.include.length > 0 || metaTags.exclude.length > 0;
  if (includeTags.length === 0 && excludeTags.length === 0 && !hasMetaTags && !hasNotesFilter) {
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

  // Add meta tag conditions (including orientation via computed column)
  for (const metaName of metaTags.include) {
    const def = getMetaTagDefinition(metaName);
    if (def?.getCondition) {
      conditions.push(def.getCondition());
    }
  }

  for (const metaName of metaTags.exclude) {
    const def = getMetaTagDefinition(metaName);
    if (def?.getCondition) {
      conditions.push({ NOT: def.getCondition() });
    }
  }

  // Add notes filter condition (fulltext search)
  if (hasNotesFilter) {
    const matchingNotes = await prisma.$queryRaw<{ postId: number }[]>`
      SELECT DISTINCT "postId"
      FROM "Note"
      WHERE to_tsvector('simple', content) @@ websearch_to_tsquery('simple', ${notesQuery})
         OR to_tsvector('simple', name) @@ websearch_to_tsquery('simple', ${notesQuery})
    `;
    const noteMatchingPostIds = matchingNotes.map((n) => n.postId);

    // If no notes match, return empty results early
    if (noteMatchingPostIds.length === 0) {
      return {
        posts: [],
        totalCount: 0,
        totalPages: 0,
        queryTimeMs: 0,
        resolvedWildcards,
      };
    }

    conditions.push({
      id: {
        in: noteMatchingPostIds,
      },
    });
  }

  const baseWhere = conditions.length > 0 ? { AND: conditions } : {};
  const where = withPostHidingFilter(baseWhere);

  const startTime = performance.now();

  // Execute search query
  const [posts, totalCount] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { importedAt: "desc" },
      skip,
      take: limit,
      select: { id: true, hash: true, width: true, height: true, blurhash: true, mimeType: true },
    }),
    prisma.post.count({ where }),
  ]);

  return {
    posts,
    totalPages: Math.ceil(totalCount / limit),
    totalCount,
    queryTimeMs: performance.now() - startTime,
    resolvedWildcards,
  };
}
