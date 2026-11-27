import { NextRequest, NextResponse } from "next/server";
import { resolvePostForMutation } from "@/lib/post-route";
import { recordFeedSwipe, removeFeedSwipe } from "@/lib/swipes";

const RATE_LIMIT_CONFIG = {
  prefix: "post-swipe",
  limit: 240,
  windowMs: 60 * 1000,
};

interface RouteParams {
  params: Promise<{ hash: string }>;
}

/**
 * Record how a swipe-feed card was answered (latest swipe per post).
 *
 * Body: `{ action: "like" | "skip", explore?: boolean }`. `explore` is the
 * flag the deck dealt the card with. Recording only: a like is saved as a
 * favorite by the favorite route, and a skip changes nothing in the ranking.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const resolved = await resolvePostForMutation(request, params, RATE_LIMIT_CONFIG);
  if ("response" in resolved) return resolved.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
  }
  const { action, explore } = body as { action?: unknown; explore?: unknown };
  if (action !== "like" && action !== "skip") {
    return NextResponse.json({ error: 'action must be "like" or "skip"' }, { status: 400 });
  }
  if (explore !== undefined && typeof explore !== "boolean") {
    return NextResponse.json({ error: "explore must be a boolean" }, { status: 400 });
  }

  await recordFeedSwipe(resolved.postId, action, explore === true);
  return NextResponse.json({ recorded: true });
}

/** Forget the swipe (undo). Idempotent. */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const resolved = await resolvePostForMutation(request, params, RATE_LIMIT_CONFIG);
  if ("response" in resolved) return resolved.response;

  await removeFeedSwipe(resolved.postId);
  return NextResponse.json({ recorded: false });
}
