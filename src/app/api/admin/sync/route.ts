import { NextRequest, NextResponse } from "next/server";
import { getSyncState } from "@/lib/hydrus";
import { syncFromHydrus, acquireSyncLock } from "@/lib/hydrus/sync";
import { prisma } from "@/lib/db";
import { verifyAdminSession } from "@/lib/auth";
import { apiLog, syncLog } from "@/lib/logger";

// GET - Get sync status
export async function GET() {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

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
    apiLog.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get sync state');
    return NextResponse.json(
      { error: "Failed to get sync state" },
      { status: 500 }
    );
  }
}

// POST - Start a sync
export async function POST(request: NextRequest) {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));

    // Runtime-validate the body: `tags`, when present, must be an array of
    // strings. An unchecked cast would let malformed input reach the sync path.
    let tags: string[] | undefined;
    if (body.tags !== undefined) {
      if (!Array.isArray(body.tags) || !body.tags.every((t: unknown) => typeof t === "string")) {
        return NextResponse.json(
          { error: "tags must be an array of strings" },
          { status: 400 }
        );
      }
      tags = body.tags;
    }

    // Compute/log BEFORE acquiring the lock so no throwable statement sits
    // between a successful acquire and the background promise start. Otherwise
    // a throw in that window would leave SyncState stuck at "running" forever,
    // since syncFromHydrus (which clears the lock on failure) was never called.
    const searchTags = tags || ["system:everything"];
    syncLog.info({ tags: searchTags }, 'Sync request initiated');

    // Atomically acquire the sync lock. The DB conditional write (not a prior
    // read) decides the winner, so two concurrent POSTs cannot both start.
    // count === 0 (acquired === false) means a sync is already running -> 409.
    const acquired = await acquireSyncLock();
    if (!acquired) {
      return NextResponse.json(
        { error: "Sync is already running" },
        { status: 409 }
      );
    }

    // Start sync in background. The lock is already held, so tell syncFromHydrus
    // not to re-acquire it (which would otherwise see "running" and reject).
    // Invoking an async fn never throws synchronously (a sync throw becomes a
    // rejected promise handled by .catch), so the lock cannot leak here.
    syncFromHydrus({ tags, lockAlreadyHeld: true })
      .then((result) => {
        syncLog.info({ processedFiles: result.processedFiles, errors: result.errors.length }, 'Background sync completed');
      })
      .catch((error) => {
        syncLog.error({ error: error instanceof Error ? error.message : String(error) }, 'Background sync failed');
      });

    return NextResponse.json({
      message: "Sync started",
      tags: searchTags,
    });
  } catch (error) {
    apiLog.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to start sync');
    return NextResponse.json(
      { error: "Failed to start sync" },
      { status: 500 }
    );
  }
}

// DELETE - Cancel running sync
export async function DELETE() {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

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

    syncLog.info({}, 'Sync cancellation requested');
    return NextResponse.json({ message: "Sync cancellation requested" });
  } catch (error) {
    apiLog.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to cancel sync');
    return NextResponse.json(
      { error: "Failed to cancel sync" },
      { status: 500 }
    );
  }
}
