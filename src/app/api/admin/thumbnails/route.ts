import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rm } from "fs/promises";
import {
  getThumbnailStats,
  batchGenerateThumbnails,
  ThumbnailStatus,
  getThumbnailBasePath,
} from "@/lib/thumbnails";
import { verifyAdminSession } from "@/lib/auth";
import { apiLog, thumbnailLog } from "@/lib/logger";
import { createBatchRunner } from "@/lib/batch-runner";

// Sane upper bounds for the batch-generation request body.
const MAX_BATCH_SIZE = 1000;
const MAX_LIMIT = 10_000_000;

const batch = createBatchRunner<{ processed: number; succeeded: number; failed: number }>();

// GET - Get thumbnail generation statistics
export async function GET() {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  try {
    const stats = await getThumbnailStats();

    return NextResponse.json({
      ...stats,
      ...batch.snapshot(),
    });
  } catch (error) {
    apiLog.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get thumbnail stats');
    return NextResponse.json(
      { error: "Failed to get thumbnail stats" },
      { status: 500 }
    );
  }
}

// POST - Start batch thumbnail generation
export async function POST(request: NextRequest) {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const limit = body.limit as number | undefined;
    const batchSize = body.batchSize as number | undefined;

    // Runtime-validate optional numeric inputs (mirrors admin/phash). These bound an unbounded
    // background job, so reject non-integers, out-of-range, and NaN/Infinity values.
    if (
      batchSize !== undefined &&
      (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE)
    ) {
      return NextResponse.json(
        { error: `batchSize must be a positive integer no greater than ${MAX_BATCH_SIZE}` },
        { status: 400 }
      );
    }
    if (
      limit !== undefined &&
      (!Number.isInteger(limit) || limit < 0 || limit > MAX_LIMIT)
    ) {
      return NextResponse.json(
        { error: `limit must be a non-negative integer no greater than ${MAX_LIMIT}` },
        { status: 400 }
      );
    }

    if (batch.running) {
      return NextResponse.json(
        { error: "Batch generation is already running" },
        { status: 409 }
      );
    }

    thumbnailLog.info({ limit: limit || 'unlimited', batchSize: batchSize || 50 }, 'Starting batch thumbnail generation');

    batch.start(
      (onProgress) => batchGenerateThumbnails({ limit, batchSize, onProgress }),
      {
        onCompleted: (result) => {
          thumbnailLog.info({ processed: result.processed, succeeded: result.succeeded, failed: result.failed }, 'Batch thumbnail generation completed');
        },
        onFailed: (message) => {
          thumbnailLog.error({ error: message }, 'Batch thumbnail generation failed');
        },
      }
    );

    return NextResponse.json({
      message: "Batch thumbnail generation started",
      limit: limit || "unlimited",
      batchSize: batchSize || 50,
    });
  } catch (error) {
    apiLog.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to start batch generation');
    return NextResponse.json(
      { error: "Failed to start batch generation" },
      { status: 500 }
    );
  }
}

// DELETE - Reset failed thumbnails or clear all thumbnails
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const resetFailed = body.resetFailed as boolean | undefined;
    const clearAll = body.clearAll as boolean | undefined;

    if (clearAll) {
      // Don't allow clearing while generation is running
      if (batch.running) {
        return NextResponse.json(
          { error: "Cannot clear thumbnails while generation is running" },
          { status: 409 }
        );
      }

      // Delete all thumbnail records from database
      const deleteResult = await prisma.thumbnail.deleteMany({});

      // Reset all posts to pending
      const updateResult = await prisma.post.updateMany({
        where: {
          thumbnailStatus: {
            in: [
              ThumbnailStatus.COMPLETE,
              ThumbnailStatus.FAILED,
              ThumbnailStatus.PROCESSING,
              ThumbnailStatus.UNSUPPORTED,
            ],
          },
        },
        data: { thumbnailStatus: ThumbnailStatus.PENDING },
      });

      // Delete thumbnail files from disk
      const basePath = getThumbnailBasePath();
      try {
        await rm(basePath, { recursive: true, force: true });
      } catch (fsError) {
        thumbnailLog.warn({ error: fsError instanceof Error ? fsError.message : String(fsError) }, 'Could not delete thumbnail directory');
      }

      return NextResponse.json({
        message: `Cleared ${deleteResult.count} thumbnail records and reset ${updateResult.count} posts`,
        thumbnailsDeleted: deleteResult.count,
        postsReset: updateResult.count,
      });
    }

    if (resetFailed) {
      const result = await prisma.post.updateMany({
        where: {
          thumbnailStatus: {
            in: [ThumbnailStatus.FAILED, ThumbnailStatus.UNSUPPORTED],
          },
        },
        data: { thumbnailStatus: ThumbnailStatus.PENDING },
      });

      return NextResponse.json({
        message: `Reset ${result.count} failed/unsupported posts to pending`,
        count: result.count,
      });
    }

    return NextResponse.json(
      { error: "No action specified. Use resetFailed: true or clearAll: true" },
      { status: 400 }
    );
  } catch (error) {
    apiLog.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to manage thumbnails');
    return NextResponse.json(
      { error: "Failed to manage thumbnails" },
      { status: 500 }
    );
  }
}
