import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPhashStats, batchComputePhashes } from "@/lib/phash";
import { verifyAdminSession } from "@/lib/auth";
import { apiLog, phashLog } from "@/lib/logger";

// Track if batch computation is running
let batchRunning = false;
let batchProgress = { processed: 0, total: 0 };

// GET - Get phash computation statistics
export async function GET() {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  try {
    const stats = await getPhashStats();

    return NextResponse.json({
      ...stats,
      batchRunning,
      batchProgress: batchRunning ? batchProgress : null,
    });
  } catch (error) {
    apiLog.error({ error: error instanceof Error ? error.message : String(error) }, "Failed to get phash stats");
    return NextResponse.json(
      { error: "Failed to get phash stats" },
      { status: 500 }
    );
  }
}

// POST - Start batch phash computation
export async function POST(request: NextRequest) {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const limit = body.limit as number | undefined;
    const batchSize = body.batchSize as number | undefined;

    if (batchRunning) {
      return NextResponse.json(
        { error: "Batch computation is already running" },
        { status: 409 }
      );
    }

    batchRunning = true;
    batchProgress = { processed: 0, total: 0 };

    phashLog.info({ limit: limit || "unlimited", batchSize: batchSize || 50 }, "Starting batch phash computation");

    batchComputePhashes({
      limit,
      batchSize,
      onProgress: (processed, total) => {
        batchProgress = { processed, total };
      },
    })
      .then((result) => {
        phashLog.info({ processed: result.processed, succeeded: result.succeeded, failed: result.failed }, "Batch phash computation completed");
      })
      .catch((error) => {
        phashLog.error({ error: error instanceof Error ? error.message : String(error) }, "Batch phash computation failed");
      })
      .finally(() => {
        batchRunning = false;
      });

    return NextResponse.json({
      message: "Batch phash computation started",
      limit: limit || "unlimited",
      batchSize: batchSize || 50,
    });
  } catch (error) {
    apiLog.error({ error: error instanceof Error ? error.message : String(error) }, "Failed to start batch phash computation");
    return NextResponse.json(
      { error: "Failed to start batch computation" },
      { status: 500 }
    );
  }
}

// DELETE - Reset all phashes for recomputation
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const resetAll = body.resetAll as boolean | undefined;

    if (!resetAll) {
      return NextResponse.json(
        { error: "No action specified. Use resetAll: true" },
        { status: 400 }
      );
    }

    if (batchRunning) {
      return NextResponse.json(
        { error: "Cannot reset while batch computation is running" },
        { status: 409 }
      );
    }

    const result = await prisma.phashEntry.deleteMany({});

    return NextResponse.json({
      message: `Deleted ${result.count} phash entries`,
      count: result.count,
    });
  } catch (error) {
    apiLog.error({ error: error instanceof Error ? error.message : String(error) }, "Failed to reset phashes");
    return NextResponse.json(
      { error: "Failed to reset phashes" },
      { status: 500 }
    );
  }
}
