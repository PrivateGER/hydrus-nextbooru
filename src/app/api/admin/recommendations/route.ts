import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth";
import { apiLog, syncLog } from "@/lib/logger";
import {
  pregenRecommendations,
  getRecommendationStats,
  hasRecommendations,
} from "@/lib/recommendations";

// Track if pregeneration is running
let isPregenRunning = false;
let lastPregenResult: { processed: number; total: number; completedAt: string } | null = null;

/**
 * GET - Get recommendation pregeneration status
 */
export async function GET() {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  try {
    const [stats, hasRecs] = await Promise.all([
      getRecommendationStats(),
      hasRecommendations(),
    ]);

    return NextResponse.json({
      status: isPregenRunning ? "running" : "idle",
      hasRecommendations: hasRecs,
      totalRecommendations: stats.totalRecommendations,
      postsWithRecommendations: stats.postsWithRecommendations,
      lastResult: lastPregenResult,
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

  if (isPregenRunning) {
    return NextResponse.json(
      { error: "Recommendation pregeneration is already running" },
      { status: 409 }
    );
  }

  try {
    isPregenRunning = true;
    syncLog.info({}, "Recommendation pregeneration started via API");

    // Run in background
    pregenRecommendations()
      .then((result) => {
        lastPregenResult = {
          processed: result.processed,
          total: result.total,
          completedAt: new Date().toISOString(),
        };
        syncLog.info(
          { processed: result.processed, total: result.total },
          "Recommendation pregeneration completed"
        );
      })
      .catch((error) => {
        syncLog.error(
          { error: error instanceof Error ? error.message : String(error) },
          "Recommendation pregeneration failed"
        );
      })
      .finally(() => {
        isPregenRunning = false;
      });

    return NextResponse.json({
      message: "Recommendation pregeneration started",
    });
  } catch (error) {
    isPregenRunning = false;
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
