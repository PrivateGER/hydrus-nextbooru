import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth";
import { apiLog, syncLog } from "@/lib/logger";
import {
  pregenRecommendations,
  getRecommendationStats,
  hasRecommendations,
  getPregenProgress,
} from "@/lib/recommendations";

/**
 * GET - Get recommendation pregeneration status and progress
 */
export async function GET() {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  try {
    const [stats, hasRecs, progress] = await Promise.all([
      getRecommendationStats(),
      hasRecommendations(),
      getPregenProgress(),
    ]);

    return NextResponse.json({
      status: progress.status,
      processed: progress.processed,
      total: progress.total,
      hasRecommendations: hasRecs,
      totalRecommendations: stats.totalRecommendations,
      postsWithRecommendations: stats.postsWithRecommendations,
    });
  } catch (error) {
    apiLog.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to get recommendation status"
    );
    return NextResponse.json(
      { error: "Failed to get recommendation status" },
      { status: 500 }
    );
  }
}

/**
 * POST - Start recommendation pregeneration
 */
export async function POST() {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  try {
    // Check if already running
    const progress = await getPregenProgress();
    if (progress.status === "running") {
      return NextResponse.json(
        { error: "Recommendation pregeneration is already running" },
        { status: 409 }
      );
    }

    syncLog.info({}, "Recommendation pregeneration started via API");

    // Run in background - the function updates Settings table with progress
    pregenRecommendations().catch((error) => {
      syncLog.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Recommendation pregeneration failed"
      );
    });

    return NextResponse.json({
      message: "Recommendation pregeneration started",
    });
  } catch (error) {
    apiLog.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to start recommendation pregeneration"
    );
    return NextResponse.json(
      { error: "Failed to start recommendation pregeneration" },
      { status: 500 }
    );
  }
}
