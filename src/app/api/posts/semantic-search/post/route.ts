import { NextRequest, NextResponse } from "next/server";
import { searchSemanticPostsByPostHash } from "@/lib/search";
import { checkApiRateLimit, type ApiRateLimitConfig } from "@/lib/rate-limit";

const HASH_PATTERN = /^[a-f0-9]{64}$/;

/**
 * Reads cached vectors + the database only (no embedding round-trip), so this
 * gets the same looser budget as the paginated image-hash search GET.
 */
const POST_SEARCH_RATE_LIMIT: ApiRateLimitConfig = {
  prefix: "posts-semantic-post-search",
  limit: 120,
  windowMs: 60 * 1000,
};

/**
 * Search posts semantically related to an existing post, using that post's
 * already-indexed image embedding (no upload required).
 *
 * Query parameters:
 * - `hash`: the 64-char SHA-256 hash of the source post
 * - `page`: page number (default 1, max 10000)
 * - `limit`: results per page (default 48, max 100)
 * - `minScore`: optional minimum cosine similarity score
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = checkApiRateLimit(request, POST_SEARCH_RATE_LIMIT);
  if (rateLimitResponse) return rateLimitResponse;

  const searchParams = request.nextUrl.searchParams;
  const hash = (searchParams.get("hash") || "").trim().toLowerCase();
  const parsedPage = parseInt(searchParams.get("page") || "1", 10);
  const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
  const limit = parseInt(searchParams.get("limit") || "48", 10);
  const minScoreParam = searchParams.get("minScore");
  const minScore = minScoreParam === null ? undefined : Number.parseFloat(minScoreParam);

  if (!HASH_PATTERN.test(hash)) {
    return NextResponse.json({ error: "Valid post hash required" }, { status: 400 });
  }

  const result = await searchSemanticPostsByPostHash(hash, page, { limit, minScore });

  if (result.notFound) {
    return NextResponse.json(
      { error: "This post has no image embedding yet. Generate embeddings in Admin." },
      { status: 404 }
    );
  }

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    posts: result.posts,
    totalCount: result.totalCount,
    totalPages: result.totalPages,
  });
}
