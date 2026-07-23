import { NextRequest, NextResponse } from "next/server";
import {
  batchComputeImageEmbeddings,
  clearEmbeddingsForConfig,
  DEFAULT_EMBEDDING_BATCH_SIZE,
  deleteFailedEmbeddingsForConfig,
  getEmbeddingSettings,
  getEmbeddingStats,
  MAX_EMBEDDING_BATCH_SIZE,
  toEmbeddingConfig,
  updateEmbeddingSettings,
} from "@/lib/embeddings";
import { verifyAdminSession } from "@/lib/auth";
import { apiLog, aiLog } from "@/lib/logger";
import { invalidateFeedCache } from "@/lib/feed";
import { invalidateEmbeddingCalibration } from "@/lib/embeddings/calibration";
import { createBatchRunner } from "@/lib/batch-runner";

type EmbeddingBatchResult = { processed: number; succeeded: number; failed: number };

// The app is deployed as a single instance, matching the other admin batch tasks.
const batch = createBatchRunner<EmbeddingBatchResult>();

export async function GET() {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  try {
    const settings = await getEmbeddingSettings();
    const stats = await getEmbeddingStats(toEmbeddingConfig(settings));

    return NextResponse.json({
      settings: {
        apiKey: settings.maskedApiKey,
        apiKeyConfigured: settings.apiKeyConfigured,
        apiKeyRequired: settings.apiKeyRequired,
        baseUrl: settings.baseUrl,
        model: settings.model,
        dimensions: settings.dimensions,
        imageMaxResolution: settings.imageMaxResolution,
      },
      stats,
      ...batch.snapshot(),
    });
  } catch (error) {
    apiLog.error({ error: error instanceof Error ? error.message : String(error) }, "Failed to get embedding stats");
    return NextResponse.json({ error: "Failed to get embedding stats" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  if (batch.running) {
    return NextResponse.json({ error: "Cannot update embedding settings while a batch is running" }, { status: 409 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    await updateEmbeddingSettings({
      apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
      baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
      model: typeof body.model === "string" ? body.model : undefined,
      dimensions: typeof body.dimensions === "number" ? body.dimensions : undefined,
      imageMaxResolution: typeof body.imageMaxResolution === "number" ? body.imageMaxResolution : undefined,
    });
    // Switching the active embedding config changes which PostEmbedding rows the
    // feed's k-NN reads, reshaping neighborhoods — invalidate the cached feed.
    invalidateFeedCache();

    return NextResponse.json({ message: "Embedding settings saved" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update embedding settings";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const limit = body.limit as number | undefined;
    const batchSize = body.batchSize as number | undefined;
    const retryFailed = Boolean(body.retryFailed);

    if (batchSize !== undefined && (!Number.isFinite(batchSize) || !Number.isInteger(batchSize) || batchSize < 1)) {
      return NextResponse.json({ error: "batchSize must be a positive integer" }, { status: 400 });
    }
    if (batchSize !== undefined && batchSize > MAX_EMBEDDING_BATCH_SIZE) {
      return NextResponse.json({ error: `batchSize must be ${MAX_EMBEDDING_BATCH_SIZE} or less` }, { status: 400 });
    }
    if (limit !== undefined && (!Number.isFinite(limit) || !Number.isInteger(limit) || limit < 0)) {
      return NextResponse.json({ error: "limit must be a non-negative integer" }, { status: 400 });
    }

    if (batch.running) {
      return NextResponse.json({ error: "Embedding batch is already running" }, { status: 409 });
    }

    aiLog.info({ limit: limit ?? "unlimited", batchSize: batchSize ?? DEFAULT_EMBEDDING_BATCH_SIZE, retryFailed }, "Starting image embedding batch");

    batch.start(
      (onProgress) => batchComputeImageEmbeddings({ limit, batchSize, retryFailed, onProgress }),
      {
        onCompleted: (result) => {
          aiLog.info(result, "Image embedding batch completed");
        },
        onFailed: (message) => {
          aiLog.error({ error: message }, "Image embedding batch failed");
        },
        // A batch — even one that failed partway — commits new embeddings that
        // feed the "For You" k-NN, so both caches drop on settlement. The
        // calibration baseline drops because its 48-row sample may have been
        // drawn mid-backfill from an early slice of the store, and new rows
        // can displace the deterministic md5-ordered sample; re-estimating
        // once per settled batch is cheap (~2s worst case). ORDER MATTERS:
        // the feed cache is invalidated in finally AFTER the calibration
        // delete settles — invalidating first would let a feed build race
        // the delete, read the stale baseline, and stay cached with nothing
        // to evict it. Fire-and-forget overall: onSettled is sync, and even
        // if the delete fails the generation fence in
        // invalidateEmbeddingCalibration's readers plus the next
        // clearCurrent/config change bound the staleness.
        onSettled: () => {
          Promise.resolve(invalidateEmbeddingCalibration())
            .catch((error) => {
              aiLog.error(
                { error: error instanceof Error ? error.message : String(error) },
                "Failed to invalidate embedding calibration after batch"
              );
            })
            .finally(() => invalidateFeedCache());
        },
      }
    );

    return NextResponse.json({
      message: "Image embedding batch started",
      limit: limit ?? "unlimited",
      batchSize: batchSize ?? DEFAULT_EMBEDDING_BATCH_SIZE,
      retryFailed,
    });
  } catch (error) {
    apiLog.error({ error: error instanceof Error ? error.message : String(error) }, "Failed to start embedding batch");
    return NextResponse.json({ error: "Failed to start embedding batch" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  if (batch.running) {
    return NextResponse.json({ error: "Cannot clear embeddings while a batch is running" }, { status: 409 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const settings = await getEmbeddingSettings();
    const config = toEmbeddingConfig(settings);

    if (body.clearCurrent === true) {
      const count = await clearEmbeddingsForConfig(config);
      // The persisted calibration baseline was estimated from the store that
      // was just wiped; a rebuild under the same config must re-estimate
      // rather than inherit it.
      await invalidateEmbeddingCalibration();
      invalidateFeedCache();
      return NextResponse.json({ message: `Deleted ${count} embeddings`, count });
    }

    if (body.clearFailed === true) {
      const count = await deleteFailedEmbeddingsForConfig(config);
      return NextResponse.json({ message: `Deleted ${count} failed embeddings`, count });
    }

    return NextResponse.json({ error: "No action specified" }, { status: 400 });
  } catch (error) {
    apiLog.error({ error: error instanceof Error ? error.message : String(error) }, "Failed to clear embeddings");
    return NextResponse.json({ error: "Failed to clear embeddings" }, { status: 500 });
  }
}
