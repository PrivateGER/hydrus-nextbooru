import { NextRequest, NextResponse } from "next/server";
import { resolvePostForMutation } from "@/lib/post-route";
import { recordPostView } from "@/lib/views";

const RATE_LIMIT_CONFIG = {
  prefix: "post-view",
  limit: 240,
  windowMs: 60 * 1000,
};

interface RouteParams {
  params: Promise<{ hash: string }>;
}

/**
 * Record an implicit view of the post (idempotent create, incrementing
 * counter). Fired once client-side when the detail page mounts, so bot/prefetch
 * SSR passes do not inflate the count.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const resolved = await resolvePostForMutation(request, params, RATE_LIMIT_CONFIG);
  if ("response" in resolved) return resolved.response;

  await recordPostView(resolved.postId);
  return NextResponse.json({ recorded: true });
}
