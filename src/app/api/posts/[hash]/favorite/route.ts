import { NextRequest, NextResponse } from "next/server";
import { resolvePostForMutation } from "@/lib/post-route";
import { setFavorite, unsetFavorite } from "@/lib/favorites";

const RATE_LIMIT_CONFIG = {
  prefix: "post-favorite",
  limit: 120,
  windowMs: 60 * 1000,
};

interface RouteParams {
  params: Promise<{ hash: string }>;
}

/** Mark the post as favorited (idempotent). Clears any feed dismissal. */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const resolved = await resolvePostForMutation(request, params, RATE_LIMIT_CONFIG);
  if ("response" in resolved) return resolved.response;

  await setFavorite(resolved.postId);
  return NextResponse.json({ favorited: true });
}

/** Remove the favorite (idempotent). */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const resolved = await resolvePostForMutation(request, params, RATE_LIMIT_CONFIG);
  if ("response" in resolved) return resolved.response;

  await unsetFavorite(resolved.postId);
  return NextResponse.json({ favorited: false });
}
