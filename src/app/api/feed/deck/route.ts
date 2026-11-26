import { NextRequest, NextResponse } from "next/server";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { sanitizePositiveInt } from "@/lib/search";
import {
  DEFAULT_DECK_LIMIT,
  MAX_DECK_LIMIT,
  getFeedDeck,
  parseExcludeList,
} from "@/lib/feed-deck";
import { apiLog } from "@/lib/logger";

const RATE_LIMIT_CONFIG = {
  prefix: "feed-deck",
  limit: 60,
  windowMs: 60 * 1000,
};

/** Upper bound on the JSON body: MAX_DECK_EXCLUDE hashes plus framing. */
const MAX_BODY_BYTES = 128 * 1024;

/**
 * Swipe deck: the next unseen posts of the "For You" feed.
 *
 * POST (not GET) because the exclude list of already-seen hashes is too long
 * for a query string. Read-only; nothing is recorded.
 *
 * Body: `{ exclude?: string[], limit?: number }`
 * - `exclude`: hashes the client has already seen or queued (invalid entries ignored)
 * - `limit`: batch size (default 10, max 30)
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = checkApiRateLimit(request, RATE_LIMIT_CONFIG);
  if (rateLimitResponse) return rateLimitResponse;

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 });
    }
    body = text.length === 0 ? {} : JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
  }

  const { exclude, limit } = body as { exclude?: unknown; limit?: unknown };
  const excluded = parseExcludeList(exclude);
  const batchSize = sanitizePositiveInt(
    typeof limit === "number" || typeof limit === "string" ? String(limit) : null,
    DEFAULT_DECK_LIMIT,
    MAX_DECK_LIMIT
  );

  try {
    const result = await getFeedDeck(excluded, batchSize);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    apiLog.error({ error: error instanceof Error ? error.message : String(error) }, "Error building feed deck");
    return NextResponse.json({ error: "Failed to build feed deck" }, { status: 500 });
  }
}
