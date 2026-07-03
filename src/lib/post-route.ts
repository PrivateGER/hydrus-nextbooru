import { NextRequest, NextResponse } from "next/server";
import { checkApiRateLimit, type ApiRateLimitConfig } from "@/lib/rate-limit";
import { getPostIdByHash } from "@/lib/favorites";

const HASH_PATTERN = /^[a-fA-F0-9]{64}$/;

export type ResolvedPostRoute = { response: NextResponse } | { postId: number };

/**
 * Shared guard for per-post mutation routes:
 * rate limit -> hash format validation -> post id lookup.
 * Returns either an error response to short-circuit with, or the post id.
 */
export async function resolvePostForMutation(
  request: NextRequest,
  params: Promise<{ hash: string }>,
  rateLimitConfig: ApiRateLimitConfig
): Promise<ResolvedPostRoute> {
  const rateLimitResponse = checkApiRateLimit(request, rateLimitConfig);
  if (rateLimitResponse) return { response: rateLimitResponse };

  const { hash } = await params;
  if (!HASH_PATTERN.test(hash)) {
    return { response: NextResponse.json({ error: "Invalid hash format" }, { status: 400 }) };
  }

  const postId = await getPostIdByHash(hash.toLowerCase());
  if (postId === null) {
    return { response: NextResponse.json({ error: "Post not found" }, { status: 404 }) };
  }

  return { postId };
}
