import { NextRequest, NextResponse } from "next/server";
import { searchPosts, sanitizePositiveInt, MAX_LIMIT, MAX_PAGE } from "@/lib/search";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { getFavoritedPostIdSet } from "@/lib/favorites";

const RATE_LIMIT_CONFIG = {
  prefix: "posts-search",
  limit: 60,
  windowMs: 60 * 1000,
};

/**
 * Search posts by included and excluded tags with pagination and support for wildcard patterns.
 * Also supports filtering by note content.
 *
 * Query parameters:
 * - `tags`: comma-separated tag names; prefix with `-` to exclude
 * - `notes`: search query for note content (full-text search)
 * - `page`: page number (default 1, max 10000)
 * - `limit`: results per page (default 48, max 100)
 *
 * @returns An object containing:
 *   - `posts`: array of matching posts (selected fields: `id`, `hash`, `width`, `height`, `blurhash`, `mimeType`, `extension`, `rating`)
 *   - `totalCount`: total number of matching posts
 *   - `totalPages`: number of pages based on the requested `limit`
 *   - `resolvedWildcards` (optional): array of resolved wildcard patterns with matched `tagIds`, `tagNames`, `tagCategories`, and `truncated` flag
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = checkApiRateLimit(request, RATE_LIMIT_CONFIG);
  if (rateLimitResponse) return rateLimitResponse;

  const searchParams = request.nextUrl.searchParams;
  const tagsParam = searchParams.get("tags") || "";
  const notesQuery = searchParams.get("notes")?.trim() || "";
  // parseInt("abc") -> NaN and `NaN || N` -> N, so non-numeric/empty input falls
  // back to the default. Math.floor + clamp keeps the result a finite positive
  // integer before it reaches Prisma take/skip via searchPosts.
  const page = sanitizePositiveInt(searchParams.get("page"), 1, MAX_PAGE);
  const limit = sanitizePositiveInt(searchParams.get("limit"), 48, MAX_LIMIT);

  // Split tags and pass directly - searchPosts handles parsing negation
  const tags = tagsParam.split(",").map(t => t.trim()).filter(Boolean);

  const result = await searchPosts(tags, page, {
    limit,
    notesQuery: notesQuery || undefined,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const favoritedIds = await getFavoritedPostIdSet(result.posts.map((p) => p.id));

  return NextResponse.json({
    posts: result.posts.map((p) => ({ ...p, favorited: favoritedIds.has(p.id) })),
    totalCount: result.totalCount,
    totalPages: result.totalPages,
    ...(result.resolvedWildcards.length > 0 && { resolvedWildcards: result.resolvedWildcards }),
  });
}
