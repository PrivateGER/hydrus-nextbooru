import { NextRequest, NextResponse } from "next/server";
import {
  MAX_LIMIT,
  MAX_PAGE,
  sanitizePositiveInt,
  searchSemanticPosts,
  SEMANTIC_SEARCH_RATE_LIMIT_CONFIG,
} from "@/lib/search";
import { checkApiRateLimit } from "@/lib/rate-limit";

/**
 * Search posts by natural-language text using multimodal image embeddings.
 *
 * Query parameters:
 * - `q`: text query
 * - `page`: page number (default 1, max 10000)
 * - `limit`: results per page (default 48, max 100)
 * - `minScore`: optional minimum cosine similarity score
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = checkApiRateLimit(request, SEMANTIC_SEARCH_RATE_LIMIT_CONFIG);
  if (rateLimitResponse) return rateLimitResponse;

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q")?.trim() || "";
  // Coerce non-numeric/empty/negative input to a safe bounded integer so NaN
  // can never reach Prisma take/skip inside searchSemanticPosts.
  const page = sanitizePositiveInt(searchParams.get("page"), 1, MAX_PAGE);
  const limit = sanitizePositiveInt(searchParams.get("limit"), 48, MAX_LIMIT);
  const minScoreParam = searchParams.get("minScore");
  const minScore = minScoreParam === null ? undefined : Number.parseFloat(minScoreParam);

  if (query.length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
  }

  const result = await searchSemanticPosts(query, page, { limit, minScore });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    posts: result.posts,
    totalCount: result.totalCount,
    totalPages: result.totalPages,
  });
}
