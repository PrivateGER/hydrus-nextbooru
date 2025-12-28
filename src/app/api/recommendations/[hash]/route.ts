import { NextRequest, NextResponse } from "next/server";
import { getRecommendationsByHash } from "@/lib/recommendations";

interface RouteParams {
  params: Promise<{ hash: string }>;
}

/**
 * Get cached recommendations for a post by hash.
 *
 * Query parameters:
 * - `limit`: max recommendations to return (default 10, max 20)
 *
 * @returns Array of recommended posts with similarity scores
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { hash } = await params;

  // Validate hash format (64 hex characters)
  if (!/^[a-fA-F0-9]{64}$/.test(hash)) {
    return NextResponse.json({ error: "Invalid hash format" }, { status: 400 });
  }

  const searchParams = request.nextUrl.searchParams;
  const parsedLimit = parseInt(searchParams.get("limit") || "10", 10);
  const limit = Number.isNaN(parsedLimit) ? 10 : Math.min(20, Math.max(1, parsedLimit));

  try {
    const recommendations = await getRecommendationsByHash(hash.toLowerCase(), limit);

    return NextResponse.json(
      { recommendations },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return NextResponse.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}
