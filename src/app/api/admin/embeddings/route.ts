import { NextRequest, NextResponse } from "next/server";
import {
  batchComputeImageEmbeddings,
  claimEmbeddingBatchIfIdle,
  clearEmbeddingsForConfig,
  completeEmbeddingBatch,
  deleteFailedEmbeddingsForConfig,
  failEmbeddingBatch,
  getEmbeddingBatchState,
  getEmbeddingSettings,
  getEmbeddingStats,
  toEmbeddingConfig,
  updateEmbeddingSettings,
  updateEmbeddingBatchProgress,
} from "@/lib/embeddings";
import { verifyAdminSession } from "@/lib/auth";
import { apiLog, aiLog } from "@/lib/logger";

export async function GET() {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  try {
    const settings = await getEmbeddingSettings();
    const stats = await getEmbeddingStats(toEmbeddingConfig(settings));
    const batchState = await getEmbeddingBatchState();

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
      ...batchState,
    });
  } catch (error) {
    apiLog.error({ error: error instanceof Error ? error.message : String(error) }, "Failed to get embedding stats");
    return NextResponse.json({ error: "Failed to get embedding stats" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  const batchState = await getEmbeddingBatchState();
  if (batchState.batchRunning) {
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
    if (limit !== undefined && (!Number.isFinite(limit) || !Number.isInteger(limit) || limit < 0)) {
      return NextResponse.json({ error: "limit must be a non-negative integer" }, { status: 400 });
    }
    const claimed = await claimEmbeddingBatchIfIdle();
    if (!claimed) {
      return NextResponse.json({ error: "Embedding batch is already running" }, { status: 409 });
    }

    aiLog.info({ limit: limit ?? "unlimited", batchSize: batchSize ?? 8, retryFailed }, "Starting image embedding batch");

    batchComputeImageEmbeddings({
      limit,
      batchSize,
      retryFailed,
      onProgress: (processed, total) => {
        void updateEmbeddingBatchProgress(processed, total).catch((error) => {
          apiLog.warn({ error: error instanceof Error ? error.message : String(error) }, "Failed to update embedding batch progress");
        });
      },
    })
      .then(async (result) => {
        await completeEmbeddingBatch(result);
        aiLog.info(result, "Image embedding batch completed");
      })
      .catch(async (error) => {
        const batchError = error instanceof Error ? error.message : String(error);
        try {
          await failEmbeddingBatch(batchError);
        } catch (stateError) {
          apiLog.error({ error: stateError instanceof Error ? stateError.message : String(stateError) }, "Failed to persist embedding batch failure");
        }
        aiLog.error({ error: batchError }, "Image embedding batch failed");
      });

    return NextResponse.json({
      message: "Image embedding batch started",
      limit: limit ?? "unlimited",
      batchSize: batchSize ?? 8,
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

  const batchState = await getEmbeddingBatchState();
  if (batchState.batchRunning) {
    return NextResponse.json({ error: "Cannot clear embeddings while a batch is running" }, { status: 409 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const settings = await getEmbeddingSettings();
    const config = toEmbeddingConfig(settings);

    if (body.clearCurrent === true) {
      const count = await clearEmbeddingsForConfig(config);
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
