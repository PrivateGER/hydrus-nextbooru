import { NextRequest, NextResponse } from "next/server";
import { searchPosts } from "@/lib/search";
import { parseTagsParamWithNegation } from "@/lib/wildcard";

/**
 * Search posts by included and excluded tags with pagination and support for wildcard patterns.
 * Also supports filtering by note content.
 *
 * Query parameters:
 * - `tags`: comma-separated tag names; prefix with `-` to exclude
 * - `notes`: search query for note content (full-text search)
 * - `page`: page number (default 1)
 * - `limit`: results per page (default 48, max 100)
 *
 * @returns An object containing:
 *   - `posts`: array of matching posts (selected fields: `id`, `hash`, `width`, `height`, `blurhash`, `mimeType`)
 *   - `totalCount`: total number of matching posts
 *   - `totalPages`: number of pages based on the requested `limit`
 *   - `resolvedWildcards` (optional): array of resolved wildcard patterns with matched `tagIds`, `tagNames`, `tagCategories`, and `truncated` flag
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tagsParam = searchParams.get("tags") || "";
  const notesQuery = searchParams.get("notes")?.trim() || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = parseInt(searchParams.get("limit") || "48", 10);

  const { includeTags, excludeTags } = parseTagsParamWithNegation(tagsParam);
  const tags = [
    ...includeTags,
    ...excludeTags.map(t => `-${t}`),
  ];

  const result = await searchPosts(tags, page, {
    limit,
    notesQuery: notesQuery || undefined,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    posts: result.posts,
    totalCount: result.totalCount,
    totalPages: result.totalPages,
    ...(result.resolvedWildcards.length > 0 && { resolvedWildcards: result.resolvedWildcards }),
  });
}
