import DOMPurify from "isomorphic-dompurify";
import { prisma } from "@/lib/db";
import {
  isWildcardPattern,
  validateWildcardPattern,
  parseTagsWithNegation,
  resolveWildcardPattern,
  ResolvedWildcard,
} from "@/lib/wildcard";

const POSTS_PER_PAGE = 48;

// Shared types
export interface PostResult {
  id: number;
  hash: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  mimeType: string;
}

export interface NoteResult {
  id: number;
  postId: number;
  name: string;
  content: string;
  headline: string | null;
  post: PostResult;
}

interface BaseSearchResult {
  totalCount: number;
  totalPages: number;
  queryTimeMs: number;
  error?: string;
}

export interface TagSearchResult extends BaseSearchResult {
  posts: PostResult[];
  resolvedWildcards: ResolvedWildcard[];
}

export interface NoteSearchResult extends BaseSearchResult {
  notes: NoteResult[];
}

/**
 * Sanitize headline HTML, allowing only <mark> tags from ts_headline.
 */
function sanitizeHeadline(headline: string | null): string | null {
  if (!headline) return null;
  return DOMPurify.sanitize(headline, { ALLOWED_TAGS: ["mark"] });
}

/**
 * Search notes by content and translations using PostgreSQL full-text search.
 */
export async function searchNotes(query: string, page: number): Promise<NoteSearchResult> {
  if (!query || query.trim().length < 2) {
    return { notes: [], totalCount: 0, totalPages: 0, queryTimeMs: 0 };
  }

  const skip = (page - 1) * POSTS_PER_PAGE;
  const startTime = performance.now();

  try {
    const [notes, countResult] = await Promise.all([
      prisma.$queryRaw<NoteResult[]>`
        SELECT
          n.id,
          n."postId",
          n.name,
          n.content,
          CASE
            WHEN to_tsvector('simple', n.content) @@ websearch_to_tsquery('simple', ${query})
            THEN ts_headline('simple', n.content, websearch_to_tsquery('simple', ${query}),
              'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20, MaxFragments=2')
            ELSE ts_headline('simple', COALESCE(n."translatedContent", ''), websearch_to_tsquery('simple', ${query}),
              'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20, MaxFragments=2')
          END as headline,
          jsonb_build_object(
            'id', p.id, 'hash', p.hash, 'width', p.width, 'height', p.height,
            'blurhash', p.blurhash, 'mimeType', p."mimeType"
          ) as post
        FROM "Note" n
        JOIN "Post" p ON n."postId" = p.id
        WHERE to_tsvector('simple', n.content) @@ websearch_to_tsquery('simple', ${query})
           OR to_tsvector('simple', COALESCE(n."translatedContent", '')) @@ websearch_to_tsquery('simple', ${query})
        ORDER BY GREATEST(
                   ts_rank(to_tsvector('simple', n.content), websearch_to_tsquery('simple', ${query})),
                   ts_rank(to_tsvector('simple', COALESCE(n."translatedContent", '')), websearch_to_tsquery('simple', ${query}))
                 ) DESC,
                 p."importedAt" DESC
        LIMIT ${POSTS_PER_PAGE} OFFSET ${skip}
      `,
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint as count FROM "Note" n
        WHERE to_tsvector('simple', n.content) @@ websearch_to_tsquery('simple', ${query})
           OR to_tsvector('simple', COALESCE(n."translatedContent", '')) @@ websearch_to_tsquery('simple', ${query})
      `,
    ]);

    const totalCount = Number(countResult[0].count);

    return {
      notes: notes.map((n) => ({
        ...n,
        headline: sanitizeHeadline(n.headline),
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
 * Search posts by tags with wildcard and negation support.
 */
export async function searchPosts(tags: string[], page: number): Promise<TagSearchResult> {
  const skip = (page - 1) * POSTS_PER_PAGE;
  const { includeTags, excludeTags } = parseTagsWithNegation(tags);

  if (includeTags.length === 0 && excludeTags.length === 0) {
    return { posts: [], totalPages: 0, totalCount: 0, queryTimeMs: 0, resolvedWildcards: [] };
  }

  // Categorize tags into regular and wildcard
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

  const where = conditions.length > 0 ? { AND: conditions } : {};

  const startTime = performance.now();
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
