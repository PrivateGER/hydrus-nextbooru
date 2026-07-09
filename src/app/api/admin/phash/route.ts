import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPhashStats, batchComputePhashes } from "@/lib/phash";
import { verifyAdminSession } from "@/lib/auth";
import { apiLog, phashLog } from "@/lib/logger";
import { createBatchRunner } from "@/lib/batch-runner";

const batch = createBatchRunner<{ processed: number; succeeded: number; failed: number }>();

// GET - Get phash computation statistics
export async function GET() {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  try {
    const stats = await getPhashStats();

    return NextResponse.json({
      ...stats,
      ...batch.snapshot(),
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

    if (batchSize !== undefined && (!Number.isFinite(batchSize) || !Number.isInteger(batchSize) || batchSize < 1)) {
      return NextResponse.json({ error: "batchSize must be a positive integer" }, { status: 400 });
    }
    if (limit !== undefined && (!Number.isFinite(limit) || !Number.isInteger(limit) || limit < 0)) {
      return NextResponse.json({ error: "limit must be a non-negative integer" }, { status: 400 });
    }

    if (batch.running) {
      return NextResponse.json(
        { error: "Batch computation is already running" },
        { status: 409 }
      );
    }

    phashLog.info({ limit: limit ?? "unlimited", batchSize: batchSize ?? 50 }, "Starting batch phash computation");

    batch.start(
      (onProgress) => batchComputePhashes({ limit, batchSize, onProgress }),
      {
        onCompleted: (result) => {
          phashLog.info({ processed: result.processed, succeeded: result.succeeded, failed: result.failed }, "Batch phash computation completed");
        },
        onFailed: (message) => {
          phashLog.error({ error: message }, "Batch phash computation failed");
        },
      }
    );

    return NextResponse.json({
      message: "Batch phash computation started",
      limit: limit ?? "unlimited",
      batchSize: batchSize ?? 50,
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

    if (batch.running) {
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
