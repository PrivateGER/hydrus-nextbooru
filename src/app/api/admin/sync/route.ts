import { NextRequest, NextResponse } from "next/server";
import { syncFromHydrus, getSyncState } from "@/lib/hydrus";
import { prisma } from "@/lib/db";

// GET - Get sync status
export async function GET() {
  try {
    const syncState = await getSyncState();

    return NextResponse.json({
      status: syncState?.status || "idle",
      lastSyncedAt: syncState?.lastSyncedAt?.toISOString() || null,
      lastSyncCount: syncState?.lastSyncCount || 0,
      errorMessage: syncState?.errorMessage || null,
      // Progress data
      totalFiles: syncState?.totalFiles || 0,
      processedFiles: syncState?.processedFiles || 0,
      currentBatch: syncState?.currentBatch || 0,
      totalBatches: syncState?.totalBatches || 0,
    });
  } catch (error) {
    console.error("Error getting sync state:", error);
    return NextResponse.json(
      { error: "Failed to get sync state" },
      { status: 500 }
    );
  }
}

// POST - Start a sync
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const tags = body.tags as string[] | undefined;

    // Check if sync is already running
    const currentState = await getSyncState();
    if (currentState?.status === "running") {
      return NextResponse.json(
        { error: "Sync is already running" },
        { status: 409 }
      );
    }

    // Start sync in background
    // We can't use streaming here easily, so we just start it and return immediately
    syncFromHydrus({ tags })
      .then((result) => {
        console.log("Sync completed:", result);
      })
      .catch((error) => {
        console.error("Sync failed:", error);
      });

    return NextResponse.json({
      message: "Sync started",
      tags: tags || ["system:everything"],
    });
  } catch (error) {
    console.error("Error starting sync:", error);
    return NextResponse.json(
      { error: "Failed to start sync" },
      { status: 500 }
    );
  }
}

// DELETE - Cancel running sync
export async function DELETE() {
  try {
    const result = await prisma.syncState.updateMany({
      where: { status: "running" },
      data: {
        status: "cancelled",
      },
    });

    if (result.count === 0) {
      return NextResponse.json({ message: "No running sync to cancel" });
    }

    return NextResponse.json({ message: "Sync cancellation requested" });
  } catch (error) {
    console.error("Error cancelling sync:", error);
    return NextResponse.json(
      { error: "Failed to cancel sync" },
      { status: 500 }
    );
  }
}
