import { NextRequest, NextResponse } from "next/server";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { sanitizePositiveInt, MAX_LIMIT, MAX_PAGE } from "@/lib/search";
import { getFeedPage } from "@/lib/feed";
import { apiLog } from "@/lib/logger";

const RATE_LIMIT_CONFIG = {
  prefix: "feed",
  limit: 60,
  windowMs: 60 * 1000,
};

/**
 * "For You" feed: posts similar to the user's favorites.
 *
 * Query parameters:
 * - `page`: page number (default 1)
 * - `limit`: results per page (default 48, max 100)
 *
 * No HTTP caching: the feed is personal and mutates on favorite/dismissal.
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = checkApiRateLimit(request, RATE_LIMIT_CONFIG);
  if (rateLimitResponse) return rateLimitResponse;

  const searchParams = request.nextUrl.searchParams;
  const page = sanitizePositiveInt(searchParams.get("page"), 1, MAX_PAGE);
  const limit = sanitizePositiveInt(searchParams.get("limit"), 48, MAX_LIMIT);

  try {
    const result = await getFeedPage(page, limit);
    return NextResponse.json(result);
  } catch (error) {
    apiLog.error({ error: error instanceof Error ? error.message : String(error) }, "Error building feed");
    return NextResponse.json({ error: "Failed to build feed" }, { status: 500 });
  }
}
