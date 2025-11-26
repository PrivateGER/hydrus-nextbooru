import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rm } from "fs/promises";
import {
  getThumbnailStats,
  batchGenerateThumbnails,
  ThumbnailStatus,
  getThumbnailBasePath,
} from "@/lib/thumbnails";

// Track if batch generation is running
let batchRunning = false;
let batchProgress = { processed: 0, total: 0 };

// GET - Get thumbnail generation statistics
export async function GET() {
  try {
    const stats = await getThumbnailStats();

    return NextResponse.json({
      ...stats,
      batchRunning,
      batchProgress: batchRunning ? batchProgress : null,
    });
  } catch (error) {
    console.error("Error getting thumbnail stats:", error);
    return NextResponse.json(
      { error: "Failed to get thumbnail stats" },
      { status: 500 }
    );
  }
}

// POST - Start batch thumbnail generation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = body.limit as number | undefined;
    const batchSize = body.batchSize as number | undefined;

    // Check if batch is already running
    if (batchRunning) {
      return NextResponse.json(
        { error: "Batch generation is already running" },
        { status: 409 }
      );
    }

    // Start batch generation in background
    batchRunning = true;
    batchProgress = { processed: 0, total: 0 };

    batchGenerateThumbnails({
      limit,
      batchSize,
      onProgress: (processed, total) => {
        batchProgress = { processed, total };
      },
    })
      .then((result) => {
        console.log("Batch thumbnail generation completed:", result);
      })
      .catch((error) => {
        console.error("Batch thumbnail generation failed:", error);
      })
      .finally(() => {
        batchRunning = false;
      });

    return NextResponse.json({
      message: "Batch thumbnail generation started",
      limit: limit || "unlimited",
      batchSize: batchSize || 50,
    });
  } catch (error) {
    console.error("Error starting batch generation:", error);
    return NextResponse.json(
      { error: "Failed to start batch generation" },
      { status: 500 }
    );
  }
}

// DELETE - Reset failed thumbnails or clear all thumbnails
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const resetFailed = body.resetFailed as boolean | undefined;
    const clearAll = body.clearAll as boolean | undefined;

    if (clearAll) {
      // Don't allow clearing while generation is running
      if (batchRunning) {
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
            in: [ThumbnailStatus.COMPLETE, ThumbnailStatus.FAILED, ThumbnailStatus.PROCESSING],
          },
        },
        data: { thumbnailStatus: ThumbnailStatus.PENDING },
      });

      // Delete thumbnail files from disk
      const basePath = getThumbnailBasePath();
      try {
        await rm(basePath, { recursive: true, force: true });
      } catch (fsError) {
        console.warn("Could not delete thumbnail directory:", fsError);
      }

      return NextResponse.json({
        message: `Cleared ${deleteResult.count} thumbnail records and reset ${updateResult.count} posts`,
        thumbnailsDeleted: deleteResult.count,
        postsReset: updateResult.count,
      });
    }

    if (resetFailed) {
      const result = await prisma.post.updateMany({
        where: { thumbnailStatus: ThumbnailStatus.FAILED },
        data: { thumbnailStatus: ThumbnailStatus.PENDING },
      });

      return NextResponse.json({
        message: `Reset ${result.count} failed posts to pending`,
        count: result.count,
      });
    }

    return NextResponse.json(
      { error: "No action specified. Use resetFailed: true or clearAll: true" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error managing thumbnails:", error);
    return NextResponse.json(
      { error: "Failed to manage thumbnails" },
      { status: 500 }
    );
  }
}
