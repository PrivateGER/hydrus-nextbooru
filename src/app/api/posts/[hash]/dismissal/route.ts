import { NextRequest, NextResponse } from "next/server";
import { resolvePostForMutation } from "@/lib/post-route";
import { setDismissal, unsetDismissal } from "@/lib/favorites";

const RATE_LIMIT_CONFIG = {
  prefix: "post-dismissal",
  limit: 120,
  windowMs: 60 * 1000,
};

interface RouteParams {
  params: Promise<{ hash: string }>;
}

/** Hide the post from the "For You" feed (idempotent). Clears any favorite. */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const resolved = await resolvePostForMutation(request, params, RATE_LIMIT_CONFIG);
  if ("response" in resolved) return resolved.response;

  await setDismissal(resolved.postId);
  return NextResponse.json({ dismissed: true });
}

/** Un-hide the post (idempotent). */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const resolved = await resolvePostForMutation(request, params, RATE_LIMIT_CONFIG);
  if ("response" in resolved) return resolved.response;

  await unsetDismissal(resolved.postId);
  return NextResponse.json({ dismissed: false });
}
