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
import { Prisma, TagCategory } from "@/generated/prisma/client";
import {
  isWildcardPattern,
  validateWildcardPattern,
  resolveWildcardPattern,
  ResolvedWildcard,
} from "@/lib/wildcard";
import { separateMetaTags, getMetaTagDefinition } from "@/lib/meta-tags";
import { OpenRouterClient, OpenRouterApiError, OpenRouterConfigError } from "@/lib/openrouter";
import { EMBEDDING_INPUT_TYPES } from "@/lib/openrouter/types";
import {
  getEmbeddingOpenRouterSettings,
  isEmbeddingProviderConfigured,
  toEmbeddingConfig,
} from "@/lib/embeddings/settings";
import { getPostEmbeddingVector, searchPostsByEmbedding } from "@/lib/embeddings/store";
import { preprocessImageBufferForEmbedding } from "@/lib/embeddings/image";
import {
  getCachedSemanticQueryEmbedding,
  normalizeSemanticQuery,
  upsertSemanticQueryEmbedding,
} from "@/lib/embeddings/query-cache";
import {
  getCachedImageQueryEmbedding,
  hashImageBytes,
  upsertImageQueryEmbedding,
} from "@/lib/embeddings/image-query-cache";
import type { ApiRateLimitConfig } from "@/lib/rate-limit";

/** Default number of results per page */
const DEFAULT_LIMIT = 48;
/** Maximum allowed results per page */
export const MAX_LIMIT = 100;
/** Maximum page number to prevent expensive offset queries */
export const MAX_PAGE = 10000;
/** Semantic search returns nearest neighbors, capped to avoid treating the whole embedding table as results. */
/** Multiples of 48 (the standard per-page size). **/
const SEMANTIC_RESULT_CAP = 48 * 6;
export const SEMANTIC_SEARCH_RATE_LIMIT_CONFIG = {
  prefix: "posts-semantic-search",
  limit: 30,
  windowMs: 60 * 1000,
} satisfies ApiRateLimitConfig;

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
  extension?: string;
  rating?: string;
  distance?: number;
  score?: number;
  /** Whether the (single) user has favorited this post. Merged at the route/page layer, never cached. */
  favorited?: boolean;
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

/**
 * A tag co-occurring with the current page of search results.
 * `count` is the number of posts on the page that carry the tag,
 * not the tag's global post count.
 */
export interface RelatedTag {
  id: number;
  name: string;
  category: TagCategory;
  count: number;
}

/** Result of searching posts by tags */
export interface TagSearchResult extends BaseSearchResult {
  posts: PostResult[];
  /** Wildcard patterns that were expanded, with their matched tags */
  resolvedWildcards: ResolvedWildcard[];
  /** Present only when requested via `includeRelatedTags` */
  relatedTags?: RelatedTag[];
}

/** Result of searching notes by content */
export interface NoteSearchResult extends BaseSearchResult {
  notes: NoteResult[];
}

/** Result of semantic text-to-image search */
export interface SemanticSearchResult extends BaseSearchResult {
  posts: PostResult[];
}

/** Options for post search */
export interface SearchPostsOptions {
  /** Results per page (default 48, max 100) */
  limit?: number;
  /** Search query for note content (min 2 chars, uses fulltext search) */
  notesQuery?: string;
  /** Compute tags co-occurring with the returned page of posts (drill-down sidebar) */
  includeRelatedTags?: boolean;
}

export interface SearchSemanticPostsOptions {
  /** Results per page (default 48, max 100) */
  limit?: number;
  /** Optional minimum cosine similarity score to include */
  minScore?: number;
}

function normalizeSemanticMinScore(minScore: number | undefined): number | undefined {
  if (minScore === undefined || !Number.isFinite(minScore)) {
    return undefined;
  }

  return Math.min(1, Math.max(-1, minScore));
}

export function normalizePositiveInteger(value: number | undefined, fallback: number, max: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(1, Math.floor(value)), max);
}

/**
 * Parse a raw query-string value (e.g. `?page=` / `?limit=`) into a finite,
 * positive, clamped integer.
 *
 * parseInt returns NaN for non-numeric input (`"abc"`), an empty/missing value,
 * and partially-numeric input is truncated (`"1e9"` -> `1`). `NaN || fallback`
 * substitutes the default; the result is then floored and clamped to
 * `[1, max]`. This guarantees a safe bounded value can never propagate into
 * Prisma `take`/`skip`.
 */
export function sanitizePositiveInt(raw: string | null | undefined, fallback: number, max: number): number {
  const parsed = parseInt(raw ?? "", 10) || fallback;
  return normalizePositiveInteger(parsed, fallback, max);
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
            n.content AS headline_source,
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
            nt."translatedContent" AS headline_source,
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
            g.title AS headline_source,
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
            ct."translatedContent" AS headline_source,
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
        ),
        deduplicated AS (
          -- Deduplicate matches, keeping highest rank (per result_type + id combination)
          SELECT DISTINCT ON (result_type, id)
            id, result_type, "postId", name, content, "contentHash", headline_source,
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
        ts_headline('simple', headline_source, q.q,
          'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20, MaxFragments=2') AS headline,
        jsonb_build_object(
          'id', post_id, 'hash', post_hash, 'width', post_width, 'height', post_height,
          'blurhash', post_blurhash, 'mimeType', post_mime
        ) AS post,
        total_count
      FROM counted
      CROSS JOIN query q
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
/**
 * Outcome of translating a tag query into a Prisma where clause.
 *
 * `empty` means the result set is provably empty (no criteria, invalid
 * wildcard, wildcard matching no tags, or notes filter matching no notes)
 * without running the main query.
 */
type PostSearchWhere =
  | {
      status: "ok";
      where: Prisma.PostWhereInput;
      resolvedWildcards: ResolvedWildcard[];
      /** Non-wildcard tag names from the query (used to exclude them from related-tags). */
      plainTagNames: string[];
    }
  | { status: "empty"; resolvedWildcards: ResolvedWildcard[]; error?: string };

/**
 * Translate a tag query (regular tags, negations, wildcards, meta tags,
 * optional notes fulltext filter) into a Prisma where clause.
 *
 * Shared by `searchPosts` (the listing) and `findSearchNeighbors` (the
 * post page's prev/next within a search context) so both interpret a query
 * identically.
 */
async function buildPostSearchWhere(tags: string[], notesQuery: string): Promise<PostSearchWhere> {
  const hasNotesFilter = notesQuery.length >= 2;

  // Separate meta tags from regular tags (also handles negation parsing)
  const { metaTags, regularTags } = separateMetaTags(tags);

  const includeTags = regularTags.include;
  const excludeTags = regularTags.exclude;

  // Check if we have any search criteria (tags, meta tags, or notes)
  const hasMetaTags = metaTags.include.length > 0 || metaTags.exclude.length > 0;
  if (includeTags.length === 0 && excludeTags.length === 0 && !hasMetaTags && !hasNotesFilter) {
    return { status: "empty", resolvedWildcards: [] };
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
    return { status: "empty", resolvedWildcards: [], error: errors[0] };
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
  const conditions: Prisma.PostWhereInput[] = [];

  // Add regular tag conditions
  for (const name of regular.include) {
    conditions.push({ tags: { some: { tag: { name: { equals: name, mode: "insensitive" as const } } } } });
  }

  for (const ids of includeWildcardIds) {
    if (ids.length === 0) {
      return { status: "empty", resolvedWildcards };
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
      WHERE "contentTsv" @@ websearch_to_tsquery('simple', ${notesQuery})
         OR "nameTsv" @@ websearch_to_tsquery('simple', ${notesQuery})
    `;
    const noteMatchingPostIds = matchingNotes.map((n) => n.postId);

    // If no notes match, the result set is empty
    if (noteMatchingPostIds.length === 0) {
      return { status: "empty", resolvedWildcards };
    }

    conditions.push({
      id: {
        in: noteMatchingPostIds,
      },
    });
  }

  return {
    status: "ok",
    where: conditions.length > 0 ? { AND: conditions } : {},
    resolvedWildcards,
    plainTagNames: [...regular.include, ...regular.exclude],
  };
}

export async function searchPosts(
  tags: string[],
  page: number,
  options?: SearchPostsOptions
): Promise<TagSearchResult> {
  // Validate and apply limits.
  // normalizePositiveInteger coerces NaN/Infinity/non-finite values to the
  // fallback so they can never reach Prisma take/skip.
  const limit = normalizePositiveInteger(options?.limit, DEFAULT_LIMIT, MAX_LIMIT);
  const requestedPage = Number.isFinite(page) ? Math.floor(page) : 1;
  const validatedPage = normalizePositiveInteger(requestedPage, 1, MAX_PAGE);
  const skip = (validatedPage - 1) * limit;

  // Early return if page exceeds maximum
  if (requestedPage > MAX_PAGE) {
    return { posts: [], totalPages: 0, totalCount: 0, queryTimeMs: 0, resolvedWildcards: [] };
  }

  const built = await buildPostSearchWhere(tags, options?.notesQuery?.trim() ?? "");
  if (built.status === "empty") {
    return {
      posts: [],
      totalPages: 0,
      totalCount: 0,
      queryTimeMs: 0,
      resolvedWildcards: built.resolvedWildcards,
      ...(built.error !== undefined && { error: built.error }),
    };
  }
  const { where, resolvedWildcards } = built;

  const startTime = performance.now();

  // Execute search query
  const [posts, totalCount] = await Promise.all([
    prisma.post.findMany({
      where,
      // id breaks importedAt ties so the listing is a total order — required
      // for stable pagination and for findSearchNeighbors' keyset queries to
      // agree with the listing.
      orderBy: [{ importedAt: "desc" }, { id: "desc" }],
      skip,
      take: limit,
      select: {
        id: true,
        hash: true,
        width: true,
        height: true,
        blurhash: true,
        mimeType: true,
        extension: true,
        rating: true,
      },
    }),
    prisma.post.count({ where }),
  ]);

  const relatedTags = options?.includeRelatedTags
    ? await getRelatedTags(
        posts.map((p) => p.id),
        built.plainTagNames
      )
    : undefined;

  return {
    posts,
    totalPages: Math.ceil(totalCount / limit),
    totalCount,
    queryTimeMs: performance.now() - startTime,
    resolvedWildcards,
    ...(relatedTags !== undefined && { relatedTags }),
  };
}

/** Prev/next hashes of a post within an ordered post listing. */
export interface SearchNeighbors {
  /** Post shown before the anchor in the listing (toward page 1), if any. */
  prevHash: string | null;
  /** Post shown after the anchor in the listing, if any. */
  nextHash: string | null;
}

/** An (importedAt, id) listing order: "desc" is newest-first. */
type ListingDirection = "desc" | "asc";

/**
 * Two keyset lookups around the anchor's (importedAt, id) sort position in a
 * filtered, direction-aware listing. Shared by search results (filtered,
 * newest-first) and the gallery (unfiltered, either direction).
 *
 * The anchor itself does not need to match the where clause (e.g. its tag
 * was removed since the listing was rendered) — neighbors are computed
 * purely from its sort position, so navigation still lands on the adjacent
 * matching posts.
 */
async function findKeysetNeighbors(
  anchor: { id: number; importedAt: Date },
  where: Prisma.PostWhereInput,
  direction: ListingDirection
): Promise<SearchNeighbors> {
  // In listing order, "next" is further along the direction and "prev" is
  // back toward page 1. For a desc listing, prev is the closest row GREATER
  // than the anchor; asc mirrors it.
  const towardPrev = direction === "desc" ? ("gt" as const) : ("lt" as const);
  const towardNext = direction === "desc" ? ("lt" as const) : ("gt" as const);
  const reverseOrder = direction === "desc" ? ("asc" as const) : ("desc" as const);

  const neighbor = (op: "gt" | "lt", order: ListingDirection) =>
    prisma.post.findFirst({
      where: {
        AND: [
          where,
          {
            OR: [
              { importedAt: { [op]: anchor.importedAt } },
              { importedAt: anchor.importedAt, id: { [op]: anchor.id } },
            ],
          },
        ],
      },
      orderBy: [{ importedAt: order }, { id: order }],
      select: { hash: true },
    });

  const [prev, next] = await Promise.all([
    neighbor(towardPrev, reverseOrder),
    neighbor(towardNext, direction),
  ]);

  return { prevHash: prev?.hash ?? null, nextHash: next?.hash ?? null };
}

/**
 * Find a post's immediate neighbors within a tag-search listing without
 * paginating through it, using the same where clause and total order as
 * `searchPosts`.
 */
export async function findSearchNeighbors(
  anchor: { id: number; importedAt: Date },
  tags: string[]
): Promise<SearchNeighbors> {
  const built = await buildPostSearchWhere(tags, "");
  if (built.status === "empty") {
    return { prevHash: null, nextHash: null };
  }

  return findKeysetNeighbors(anchor, built.where, "desc");
}

/**
 * Find a post's immediate neighbors within the gallery listing (all posts
 * ordered by import time). Random sort is handled separately by
 * `findRotationNeighbors` in lib/random-order.ts.
 */
export async function findGalleryNeighbors(
  anchor: { id: number; importedAt: Date },
  sort: "newest" | "oldest"
): Promise<SearchNeighbors> {
  return findKeysetNeighbors(anchor, {}, sort === "newest" ? "desc" : "asc");
}

/** Cap on co-occurring tags returned for the search drill-down sidebar */
const RELATED_TAGS_LIMIT = 30;

/**
 * Tags carried by the given posts, ordered by how many of the posts have them.
 *
 * This deliberately samples the current page rather than aggregating the full
 * result set: cost stays O(page size) regardless of how many posts matched,
 * and "related to what you are looking at" is the more useful semantic for
 * query refinement.
 */
async function getRelatedTags(
  postIds: number[],
  excludedTagNames: string[]
): Promise<RelatedTag[]> {
  if (postIds.length === 0) {
    return [];
  }

  const excludedLower = excludedTagNames.map((name) => name.toLowerCase());
  const exclusionClause =
    excludedLower.length > 0
      ? Prisma.sql`AND LOWER(t.name) NOT IN (${Prisma.join(excludedLower)})`
      : Prisma.empty;

  return prisma.$queryRaw<RelatedTag[]>`
    SELECT t.id, t.name, t.category::text as category, COUNT(*)::int as count
    FROM "PostTag" pt
    JOIN "Tag" t ON t.id = pt."tagId"
    WHERE pt."postId" IN (${Prisma.join(postIds)})
      ${exclusionClause}
    GROUP BY t.id, t.name, t.category
    ORDER BY count DESC, t.name ASC
    LIMIT ${RELATED_TAGS_LIMIT}
  `;
}

/**
 * Search image embeddings with a natural-language text query.
 *
 * The query is embedded with the active OpenRouter multimodal embedding model,
 * then compared against image embeddings stored in VectorChord/Postgres.
 */
export async function searchSemanticPosts(
  query: string,
  page: number,
  options?: SearchSemanticPostsOptions
): Promise<SemanticSearchResult> {
  const normalizedQuery = normalizeSemanticQuery(query);
  if (normalizedQuery.length < 2) {
    return { posts: [], totalCount: 0, totalPages: 0, queryTimeMs: 0 };
  }

  const limit = normalizePositiveInteger(options?.limit, DEFAULT_LIMIT, MAX_LIMIT);
  const minScore = normalizeSemanticMinScore(options?.minScore);
  const requestedPage = Number.isFinite(page) ? Math.floor(page) : 1;
  const validatedPage = Math.min(Math.max(1, requestedPage), MAX_PAGE);
  if (requestedPage > MAX_PAGE) {
    return { posts: [], totalCount: 0, totalPages: 0, queryTimeMs: 0 };
  }

  const skip = (validatedPage - 1) * limit;
  const startTime = performance.now();

  try {
    const settings = await getEmbeddingOpenRouterSettings();
    const embeddingConfig = toEmbeddingConfig(settings);
    const queryConfig = {
      baseUrl: embeddingConfig.baseUrl,
      model: embeddingConfig.model,
      dimensions: embeddingConfig.dimensions,
    };
    const cachedEmbedding = await getCachedSemanticQueryEmbedding(normalizedQuery, queryConfig);
    let queryEmbedding = cachedEmbedding?.embedding ?? null;

    if (!queryEmbedding) {
      if (!isEmbeddingProviderConfigured(settings)) {
        return {
          posts: [],
          totalCount: 0,
          totalPages: 0,
          queryTimeMs: performance.now() - startTime,
          error: "OpenRouter API key not configured for embeddings",
        };
      }

      const client = new OpenRouterClient({
        apiKey: settings.apiKey ?? "",
        model: settings.model,
        baseUrl: embeddingConfig.baseUrl,
      });

      const embedding = await client.createEmbedding({
        model: settings.model,
        input: normalizedQuery,
        dimensions: settings.dimensions,
        encoding_format: "float",
        input_type: EMBEDDING_INPUT_TYPES.SEARCH_QUERY,
      });

      queryEmbedding = (await upsertSemanticQueryEmbedding({
        query: normalizedQuery,
        config: queryConfig,
        embedding: embedding.embedding,
      })).embedding;
    }

    const result = await searchPostsByEmbedding({
      config: embeddingConfig,
      embedding: queryEmbedding,
      skip,
      limit,
      minScore,
      resultCap: SEMANTIC_RESULT_CAP,
    });

    return {
      posts: result.posts,
      totalCount: result.totalCount,
      totalPages: Math.ceil(result.totalCount / limit),
      queryTimeMs: performance.now() - startTime,
    };
  } catch (error) {
    console.error("Semantic search error:", error);

    const message =
      error instanceof OpenRouterConfigError || error instanceof OpenRouterApiError
        ? error.message
        : "Failed to search image embeddings";

    return {
      posts: [],
      totalCount: 0,
      totalPages: 0,
      queryTimeMs: performance.now() - startTime,
      error: message,
    };
  }
}

/** Outcome of embedding an uploaded query image for image-based semantic search. */
export type PrepareImageQueryEmbeddingResult =
  | { imageHash: string }
  | { error: string; reason: "not_configured" | "invalid_image" | "embed_failed" };

/** Result of an image-based semantic search, with a `notFound` flag when the query embedding is uncached. */
export interface SemanticImageSearchResult extends SemanticSearchResult {
  /** True when no cached embedding exists for the supplied hash (caller should prompt a re-upload). */
  notFound?: boolean;
}

/**
 * Embed an uploaded query image with the active multimodal model and cache the
 * vector keyed by the SHA-256 of its raw bytes plus preprocessing config.
 *
 * The hash is returned so the client can run (and paginate) the actual vector
 * search via {@link searchSemanticPostsByImageHash} without re-uploading. A
 * byte-identical image under the same preprocessing settings is served straight
 * from cache, so no embedding round-trip occurs. The query image is embedded with
 * the same `SEARCH_DOCUMENT` input type used when indexing post images, keeping
 * the query vector in the same space as the corpus for apples-to-apples cosine
 * similarity.
 */
export async function prepareImageQueryEmbedding(
  buffer: Buffer
): Promise<PrepareImageQueryEmbeddingResult> {
  const imageHash = hashImageBytes(buffer);
  const settings = await getEmbeddingOpenRouterSettings();
  const embeddingConfig = toEmbeddingConfig(settings);
  const queryConfig = {
    baseUrl: embeddingConfig.baseUrl,
    model: embeddingConfig.model,
    dimensions: embeddingConfig.dimensions,
    imageMaxResolution: embeddingConfig.imageMaxResolution,
  };

  const cached = await getCachedImageQueryEmbedding(imageHash, queryConfig);
  if (cached) {
    return { imageHash };
  }

  if (!isEmbeddingProviderConfigured(settings)) {
    return { error: "OpenRouter API key not configured for embeddings", reason: "not_configured" };
  }

  // Decode/resize first so a corrupt or non-image payload (which can slip past a
  // client-supplied MIME type) is reported as a client error, not a gateway one.
  let processed;
  try {
    processed = await preprocessImageBufferForEmbedding(buffer, embeddingConfig.imageMaxResolution);
  } catch (error) {
    console.error("Image query decode error:", error);
    return { error: "Could not read the uploaded file as an image", reason: "invalid_image" };
  }

  try {
    const client = new OpenRouterClient({
      apiKey: settings.apiKey ?? "",
      model: settings.model,
      baseUrl: embeddingConfig.baseUrl,
    });
    const embedding = await client.createImageEmbedding({
      model: settings.model,
      imageUrl: processed.dataUrl,
      dimensions: settings.dimensions,
    });

    await upsertImageQueryEmbedding({
      imageHash,
      config: queryConfig,
      embedding: embedding.embedding,
    });

    return { imageHash };
  } catch (error) {
    console.error("Image query embedding error:", error);
    const message =
      error instanceof OpenRouterConfigError || error instanceof OpenRouterApiError
        ? error.message
        : "Failed to embed the uploaded image";
    return { error: message, reason: "embed_failed" };
  }
}

/**
 * Search image embeddings using a previously cached query-image vector.
 *
 * Looks up the vector cached under `imageHash` for the *current* embedding
 * config, then ranks stored post embeddings by cosine distance. If the embedding
 * config changed since the image was embedded (e.g. an admin switched models),
 * the lookup misses and `notFound` is returned so the caller can request a fresh
 * upload. Pagination reuses the cached vector — no re-embedding per page.
 */
export async function searchSemanticPostsByImageHash(
  imageHash: string,
  page: number,
  options?: SearchSemanticPostsOptions
): Promise<SemanticImageSearchResult> {
  const limit = normalizePositiveInteger(options?.limit, DEFAULT_LIMIT, MAX_LIMIT);
  const minScore = normalizeSemanticMinScore(options?.minScore);
  const requestedPage = Number.isFinite(page) ? Math.floor(page) : 1;
  const validatedPage = Math.min(Math.max(1, requestedPage), MAX_PAGE);
  if (requestedPage > MAX_PAGE) {
    return { posts: [], totalCount: 0, totalPages: 0, queryTimeMs: 0 };
  }

  const skip = (validatedPage - 1) * limit;
  const startTime = performance.now();

  try {
    const settings = await getEmbeddingOpenRouterSettings();
    const embeddingConfig = toEmbeddingConfig(settings);
    const cached = await getCachedImageQueryEmbedding(imageHash, {
      baseUrl: embeddingConfig.baseUrl,
      model: embeddingConfig.model,
      dimensions: embeddingConfig.dimensions,
      imageMaxResolution: embeddingConfig.imageMaxResolution,
    });

    if (!cached) {
      return {
        posts: [],
        totalCount: 0,
        totalPages: 0,
        queryTimeMs: performance.now() - startTime,
        notFound: true,
      };
    }

    const result = await searchPostsByEmbedding({
      config: embeddingConfig,
      embedding: cached.embedding,
      skip,
      limit,
      minScore,
      resultCap: SEMANTIC_RESULT_CAP,
    });

    return {
      posts: result.posts,
      totalCount: result.totalCount,
      totalPages: Math.ceil(result.totalCount / limit),
      queryTimeMs: performance.now() - startTime,
    };
  } catch (error) {
    console.error("Image semantic search error:", error);
    const message =
      error instanceof OpenRouterConfigError || error instanceof OpenRouterApiError
        ? error.message
        : "Failed to search image embeddings";
    return {
      posts: [],
      totalCount: 0,
      totalPages: 0,
      queryTimeMs: performance.now() - startTime,
      error: message,
    };
  }
}

/**
 * Search image embeddings using an existing post's already-indexed vector.
 *
 * Reuses the embedding computed when the post was synced/embedded — no upload,
 * no query round-trip — so any post with a COMPLETE embedding under the active
 * config can seed the same ranked, paginated view as an uploaded query image.
 * The source post is excluded from its own results (it would otherwise rank
 * first at distance 0). If the post has no embedding for the current config
 * (never embedded, or the model changed), `notFound` is returned so the caller
 * can explain why there are no results.
 */
export async function searchSemanticPostsByPostHash(
  postHash: string,
  page: number,
  options?: SearchSemanticPostsOptions
): Promise<SemanticImageSearchResult> {
  const limit = normalizePositiveInteger(options?.limit, DEFAULT_LIMIT, MAX_LIMIT);
  const minScore = normalizeSemanticMinScore(options?.minScore);
  const requestedPage = Number.isFinite(page) ? Math.floor(page) : 1;
  const validatedPage = Math.min(Math.max(1, requestedPage), MAX_PAGE);
  if (requestedPage > MAX_PAGE) {
    return { posts: [], totalCount: 0, totalPages: 0, queryTimeMs: 0 };
  }

  const skip = (validatedPage - 1) * limit;
  const startTime = performance.now();

  try {
    const settings = await getEmbeddingOpenRouterSettings();
    const embeddingConfig = toEmbeddingConfig(settings);
    const source = await getPostEmbeddingVector({ hash: postHash, config: embeddingConfig });

    if (!source) {
      return {
        posts: [],
        totalCount: 0,
        totalPages: 0,
        queryTimeMs: performance.now() - startTime,
        notFound: true,
      };
    }

    const result = await searchPostsByEmbedding({
      config: embeddingConfig,
      embedding: source.embedding,
      skip,
      limit,
      minScore,
      resultCap: SEMANTIC_RESULT_CAP,
      excludePostId: source.postId,
    });

    return {
      posts: result.posts,
      totalCount: result.totalCount,
      totalPages: Math.ceil(result.totalCount / limit),
      queryTimeMs: performance.now() - startTime,
    };
  } catch (error) {
    console.error("Post semantic search error:", error);
    const message =
      error instanceof OpenRouterConfigError || error instanceof OpenRouterApiError
        ? error.message
        : "Failed to search image embeddings";
    return {
      posts: [],
      totalCount: 0,
      totalPages: 0,
      queryTimeMs: performance.now() - startTime,
      error: message,
    };
  }
}
