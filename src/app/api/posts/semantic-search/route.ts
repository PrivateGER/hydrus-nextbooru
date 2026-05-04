import { NextRequest, NextResponse } from "next/server";
import { searchSemanticPosts } from "@/lib/search";
import { checkApiRateLimit } from "@/lib/rate-limit";

const MAX_PAGE = 10000;

const RATE_LIMIT_CONFIG = {
  prefix: "posts-semantic-search",
  limit: 30,
  windowMs: 60 * 1000,
};

/**
 * Search posts by natural-language text using multimodal image embeddings.
 *
 * Query parameters:
 * - `q`: text query
 * - `page`: page number (default 1, max 10000)
 * - `limit`: results per page (default 48, max 100)
 * - `minScore`: minimum cosine similarity score (default 0.25)
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = checkApiRateLimit(request, RATE_LIMIT_CONFIG);
  if (rateLimitResponse) return rateLimitResponse;

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q")?.trim() || "";
  const page = Math.min(MAX_PAGE, Math.max(1, parseInt(searchParams.get("page") || "1", 10)));
  const limit = parseInt(searchParams.get("limit") || "48", 10);
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
