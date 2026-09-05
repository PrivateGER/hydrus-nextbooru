import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  batchComputeEmbeddings,
  MAX_EMBEDDING_BATCH_SIZE,
} from "@/lib/embeddings/batch";
import type { EmbeddingPostToProcess } from "@/lib/embeddings/store";
import type { EmbeddingMediaInput } from "@/lib/openrouter/types";

const mocks = vi.hoisted(() => {
  const state = {
    assertVectorExtensionsAvailable: vi.fn(),
    countPendingEmbeddings: vi.fn(),
    findEmbeddingPostsToProcess: vi.fn(),
    getEmbeddingOpenRouterSettings: vi.fn(),
    isEmbeddingProviderConfigured: vi.fn(),
    preprocessImageForEmbedding: vi.fn(),
    preprocessVideoForEmbedding: vi.fn(),
    isVideoToolingAvailable: vi.fn(),
    toEmbeddingConfig: vi.fn(),
    upsertCompleteEmbedding: vi.fn(),
    upsertFailedEmbedding: vi.fn(),
    createMediaEmbeddings: vi.fn(),
  };

  function OpenRouterClient() {
    return {
      createMediaEmbeddings: state.createMediaEmbeddings,
    };
  }

  return {
    ...state,
    OpenRouterConfigError: class OpenRouterConfigError extends Error {},
    OpenRouterClient: vi.fn(OpenRouterClient),
  };
});

vi.mock("@/lib/openrouter", () => ({
  OpenRouterClient: mocks.OpenRouterClient,
  OpenRouterConfigError: mocks.OpenRouterConfigError,
}));

vi.mock("@/lib/hydrus/paths", () => ({
  buildFilePath: (hash: string, extension: string) => `/files/${hash}${extension}`,
}));

vi.mock("@/lib/logger", () => ({
  aiLog: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/lib/embeddings/image", () => ({
  preprocessImageForEmbedding: mocks.preprocessImageForEmbedding,
}));

vi.mock("@/lib/embeddings/video", () => ({
  preprocessVideoForEmbedding: mocks.preprocessVideoForEmbedding,
  isVideoToolingAvailable: mocks.isVideoToolingAvailable,
}));

vi.mock("@/lib/embeddings/settings", () => ({
  getEmbeddingSettings: vi.fn(),
  getEmbeddingOpenRouterSettings: mocks.getEmbeddingOpenRouterSettings,
  isEmbeddingProviderConfigured: mocks.isEmbeddingProviderConfigured,
  toEmbeddingConfig: mocks.toEmbeddingConfig,
}));

vi.mock("@/lib/embeddings/store", () => ({
  assertVectorExtensionsAvailable: mocks.assertVectorExtensionsAvailable,
  countPendingEmbeddings: mocks.countPendingEmbeddings,
  findEmbeddingPostsToProcess: mocks.findEmbeddingPostsToProcess,
  getEmbeddingStats: vi.fn(),
  upsertCompleteEmbedding: mocks.upsertCompleteEmbedding,
  upsertFailedEmbedding: mocks.upsertFailedEmbedding,
}));

const config = {
  baseUrl: "https://openrouter.ai/api/v1",
  model: "google/gemini-embedding-2-preview",
  dimensions: 3,
  imageMaxResolution: 1024,
  videoEnabled: true,
};

function post(id: number): EmbeddingPostToProcess {
  return {
    id,
    hash: `hash-${id}`,
    extension: ".png",
    mimeType: "image/png",
    width: 100,
    height: 100,
  };
}

function videoPost(id: number): EmbeddingPostToProcess {
  return { ...post(id), extension: ".mp4", mimeType: "video/mp4", width: 1280, height: 720 };
}

function processedImage(id: number) {
  return {
    dataUrl: `data:image/webp;base64,${id}`,
    sourceWidth: 100,
    sourceHeight: 100,
    processedWidth: 100,
    processedHeight: 100,
    byteLength: 1000,
  };
}

function processedVideo(id: number) {
  return {
    dataUrl: `data:video/mp4;base64,${id}`,
    format: "mp4",
    sourceWidth: 1280,
    sourceHeight: 720,
    processedWidth: 480,
    processedHeight: 270,
    sampledRanges: [{ start: 0, end: 10 }],
  };
}

function idFromPath(filePath: string): number {
  return Number(filePath.match(/hash-(\d+)/)?.[1] ?? 0);
}

/** Batched requests carry every prepared post; fallbacks carry exactly one. */
function batchedCalls() {
  return mocks.createMediaEmbeddings.mock.calls.filter(([call]) => call.media.length > 1);
}

function fallbackCalls() {
  return mocks.createMediaEmbeddings.mock.calls.filter(([call]) => call.media.length === 1);
}

/**
 * Yield the event loop a few microtask turns so concurrently started work can
 * interleave without binding the test to wall-clock time.
 */
async function yieldTurns(turns = 4): Promise<void> {
  for (let index = 0; index < turns; index++) {
    await Promise.resolve();
  }
}

describe("batchComputeEmbeddings", () => {
  beforeEach(() => {
    mocks.assertVectorExtensionsAvailable.mockResolvedValue(undefined);
    mocks.countPendingEmbeddings.mockResolvedValue(0);
    mocks.findEmbeddingPostsToProcess.mockResolvedValue([]);
    mocks.getEmbeddingOpenRouterSettings.mockResolvedValue({ apiKey: "or-key", ...config });
    mocks.isEmbeddingProviderConfigured.mockReturnValue(true);
    mocks.toEmbeddingConfig.mockReturnValue(config);
    mocks.preprocessImageForEmbedding.mockReset();
    mocks.preprocessImageForEmbedding.mockImplementation(async (filePath: string) => processedImage(idFromPath(filePath)));
    mocks.preprocessVideoForEmbedding.mockReset();
    mocks.preprocessVideoForEmbedding.mockImplementation(async (filePath: string) => processedVideo(idFromPath(filePath)));
    mocks.isVideoToolingAvailable.mockResolvedValue(true);
    mocks.upsertCompleteEmbedding.mockReset();
    mocks.upsertCompleteEmbedding.mockResolvedValue(undefined);
    mocks.upsertFailedEmbedding.mockReset();
    mocks.upsertFailedEmbedding.mockResolvedValue(undefined);
    mocks.createMediaEmbeddings.mockReset();
  });

  it("rejects batch sizes above the bounded in-memory batch limit", async () => {
    await expect(
      batchComputeEmbeddings({ batchSize: MAX_EMBEDDING_BATCH_SIZE + 1 })
    ).rejects.toThrow(`batchSize must be ${MAX_EMBEDDING_BATCH_SIZE} or less`);

    expect(mocks.assertVectorExtensionsAvailable).not.toHaveBeenCalled();
  });

  it("limits concurrent preprocessing within a batch", async () => {
    const posts = [post(1), post(2), post(3), post(4), post(5)];
    let activePreprocesses = 0;
    let maxActivePreprocesses = 0;

    mocks.countPendingEmbeddings.mockResolvedValue(posts.length);
    mocks.findEmbeddingPostsToProcess.mockResolvedValue(posts);
    mocks.preprocessImageForEmbedding.mockImplementation(async (filePath: string) => {
      activePreprocesses++;
      maxActivePreprocesses = Math.max(maxActivePreprocesses, activePreprocesses);
      await yieldTurns();
      activePreprocesses--;
      return processedImage(idFromPath(filePath));
    });
    mocks.createMediaEmbeddings.mockImplementation(async ({ media }: { media: EmbeddingMediaInput[] }) =>
      media.map((_, index) => ({ embedding: [index + 1, 0, 0], model: config.model }))
    );

    const result = await batchComputeEmbeddings({ batchSize: posts.length });

    expect(result).toEqual({ processed: posts.length, succeeded: posts.length, failed: 0 });
    expect(maxActivePreprocesses).toBeLessThanOrEqual(2);
    expect(mocks.preprocessImageForEmbedding).toHaveBeenCalledTimes(posts.length);
    expect(mocks.createMediaEmbeddings).toHaveBeenCalledTimes(1);
  });

  it("routes videos through the ffmpeg sampler and sends them as input_video parts", async () => {
    const posts = [post(1), videoPost(2), post(3)];

    mocks.countPendingEmbeddings.mockResolvedValue(posts.length);
    mocks.findEmbeddingPostsToProcess.mockResolvedValue(posts);
    mocks.createMediaEmbeddings.mockImplementation(async ({ media }: { media: EmbeddingMediaInput[] }) =>
      media.map((_, index) => ({ embedding: [index + 1, 0, 0], model: config.model }))
    );

    const result = await batchComputeEmbeddings({ batchSize: posts.length });

    expect(result).toEqual({ processed: 3, succeeded: 3, failed: 0 });
    expect(mocks.preprocessImageForEmbedding.mock.calls.map(([filePath]) => filePath)).toEqual([
      "/files/hash-1.png",
      "/files/hash-3.png",
    ]);
    expect(mocks.preprocessVideoForEmbedding).toHaveBeenCalledWith("/files/hash-2.mp4");

    const [request] = mocks.createMediaEmbeddings.mock.calls[0];
    const byDataUrl = new Map(request.media.map((media: EmbeddingMediaInput) => [media.dataUrl, media]));
    expect(byDataUrl.get("data:video/mp4;base64,2")).toEqual({
      type: "video",
      dataUrl: "data:video/mp4;base64,2",
      format: "mp4",
    });
    expect(byDataUrl.get("data:image/webp;base64,1")).toEqual({ type: "image", dataUrl: "data:image/webp;base64,1" });

    const videoRow = mocks.upsertCompleteEmbedding.mock.calls.map(([call]) => call).find((call) => call.postId === 2);
    expect(videoRow).toMatchObject({
      sourceWidth: 1280,
      sourceHeight: 720,
      processedWidth: 480,
      processedHeight: 270,
    });
  });

  it("records a failed row when the video sampler throws and still embeds the rest of the batch", async () => {
    const posts = [videoPost(1), post(2)];

    mocks.countPendingEmbeddings.mockResolvedValue(posts.length);
    mocks.findEmbeddingPostsToProcess.mockResolvedValue(posts);
    mocks.preprocessVideoForEmbedding.mockRejectedValue(new Error("ffmpeg exited with code 1"));
    mocks.createMediaEmbeddings.mockImplementation(async ({ media }: { media: EmbeddingMediaInput[] }) =>
      media.map((_, index) => ({ embedding: [index + 1, 0, 0], model: config.model }))
    );

    const result = await batchComputeEmbeddings({ batchSize: posts.length });

    expect(result).toEqual({ processed: 2, succeeded: 1, failed: 1 });
    expect(mocks.upsertFailedEmbedding).toHaveBeenCalledTimes(1);
    expect(mocks.upsertFailedEmbedding.mock.calls[0][0]).toMatchObject({
      postId: 1,
      errorMessage: "ffmpeg exited with code 1",
      sourceWidth: 1280,
      sourceHeight: 720,
      processedWidth: null,
    });
    expect(mocks.createMediaEmbeddings.mock.calls[0][0].media).toEqual([
      { type: "image", dataUrl: "data:image/webp;base64,2" },
    ]);
  });

  it("keeps individual fallback embedding retries concurrency-limited", async () => {
    const posts = [post(1), post(2), post(3), post(4), post(5)];
    let activeFallbackRequests = 0;
    let maxActiveFallbackRequests = 0;

    mocks.countPendingEmbeddings.mockResolvedValue(posts.length);
    mocks.findEmbeddingPostsToProcess.mockResolvedValue(posts);
    mocks.createMediaEmbeddings.mockImplementation(async ({ media }: { media: EmbeddingMediaInput[] }) => {
      if (media.length > 1) {
        throw new Error("backend rejected batched image input");
      }
      activeFallbackRequests++;
      maxActiveFallbackRequests = Math.max(maxActiveFallbackRequests, activeFallbackRequests);
      await yieldTurns();
      activeFallbackRequests--;
      return [{ embedding: [1, 0, 0], model: config.model }];
    });

    const result = await batchComputeEmbeddings({ batchSize: posts.length });

    expect(result).toEqual({ processed: posts.length, succeeded: posts.length, failed: 0 });
    expect(maxActiveFallbackRequests).toBeLessThanOrEqual(2);
    expect(batchedCalls()).toHaveLength(1);
    expect(fallbackCalls()).toHaveLength(posts.length);
  });

  it("only retries prepared posts not already persisted after partial batched processing", async () => {
    const posts = [post(1), post(2), post(3)];

    mocks.countPendingEmbeddings.mockResolvedValue(posts.length);
    mocks.findEmbeddingPostsToProcess.mockResolvedValue(posts);
    mocks.createMediaEmbeddings.mockImplementation(async ({ media }: { media: EmbeddingMediaInput[] }) =>
      media.length > 1
        ? [{ embedding: [1, 0, 0], model: config.model }]
        : [{ embedding: [0, 1, 0], model: config.model }]
    );

    const result = await batchComputeEmbeddings({ batchSize: posts.length });

    expect(result).toEqual({ processed: posts.length, succeeded: posts.length, failed: 0 });
    expect(mocks.upsertCompleteEmbedding).toHaveBeenCalledTimes(posts.length);
    expect(mocks.upsertCompleteEmbedding.mock.calls.map(([call]) => call.postId)).toEqual([1, 2, 3]);
    expect(fallbackCalls()).toHaveLength(2);
  });

  it("waits for in-flight batched writes before selecting fallback retries", async () => {
    const posts = [post(1), post(2), post(3)];

    mocks.countPendingEmbeddings.mockResolvedValue(posts.length);
    mocks.findEmbeddingPostsToProcess.mockResolvedValue(posts);
    mocks.createMediaEmbeddings.mockImplementation(async ({ media }: { media: EmbeddingMediaInput[] }) =>
      media.length > 1
        ? [{ embedding: [1, 0, 0], model: config.model }]
        : [{ embedding: [0, 1, 0], model: config.model }]
    );
    mocks.upsertCompleteEmbedding.mockImplementation(async ({ postId }: { postId: number }) => {
      if (postId === 1) {
        await yieldTurns();
      }
    });

    const result = await batchComputeEmbeddings({ batchSize: posts.length });

    expect(result).toEqual({ processed: posts.length, succeeded: posts.length, failed: 0 });
    expect(fallbackCalls().map(([call]) => call.media[0].dataUrl)).toEqual([
      "data:image/webp;base64,2",
      "data:image/webp;base64,3",
    ]);
  });

  it("continues processing later batches after one batch fails unexpectedly", async () => {
    const posts = [post(1), post(2), post(3), post(4)];

    mocks.countPendingEmbeddings.mockResolvedValue(posts.length);
    mocks.findEmbeddingPostsToProcess.mockImplementation(async ({ lastId }: { lastId?: number }) =>
      lastId === undefined ? posts.slice(0, 2) : posts.slice(2)
    );
    mocks.preprocessImageForEmbedding.mockImplementation(async (filePath: string) => {
      const id = idFromPath(filePath);
      if (id <= 2) {
        throw new Error("sharp failed");
      }
      return processedImage(id);
    });
    mocks.upsertFailedEmbedding.mockRejectedValue(new Error("failed status write failed"));
    mocks.createMediaEmbeddings.mockImplementation(async ({ media }: { media: EmbeddingMediaInput[] }) =>
      media.map((_, index) => ({ embedding: [index + 1, 0, 0], model: config.model }))
    );

    const result = await batchComputeEmbeddings({ batchSize: 2 });

    expect(result).toEqual({ processed: posts.length, succeeded: 2, failed: 2 });
    expect(mocks.findEmbeddingPostsToProcess).toHaveBeenCalledTimes(2);
    expect(mocks.createMediaEmbeddings).toHaveBeenCalledTimes(1);
    expect(mocks.upsertCompleteEmbedding.mock.calls.map(([call]) => call.postId)).toEqual([3, 4]);
  });

  it("fails fast when video embedding is enabled but ffmpeg is missing", async () => {
    mocks.isVideoToolingAvailable.mockResolvedValue(false);
    mocks.countPendingEmbeddings.mockResolvedValue(3);

    await expect(batchComputeEmbeddings()).rejects.toThrow(/ffmpeg\/ffprobe are not available/);
    expect(mocks.findEmbeddingPostsToProcess).not.toHaveBeenCalled();
    expect(mocks.upsertFailedEmbedding).not.toHaveBeenCalled();
  });

  it("does not require ffmpeg when video embedding is disabled", async () => {
    mocks.toEmbeddingConfig.mockReturnValue({ ...config, videoEnabled: false });
    mocks.isVideoToolingAvailable.mockReset();
    mocks.isVideoToolingAvailable.mockResolvedValue(false);

    await expect(batchComputeEmbeddings()).resolves.toEqual({ processed: 0, succeeded: 0, failed: 0 });
    expect(mocks.isVideoToolingAvailable).not.toHaveBeenCalled();
  });

  it("splits mixed media into requests below the production byte budget", async () => {
    const posts = [videoPost(1), post(2), videoPost(3), post(4)];
    const requestBudgetBytes = 40 * 1024 * 1024;
    const largePayload = "x".repeat(21 * 1024 * 1024);

    mocks.countPendingEmbeddings.mockResolvedValue(posts.length);
    mocks.findEmbeddingPostsToProcess.mockResolvedValue(posts);
    mocks.preprocessVideoForEmbedding.mockImplementation(async (filePath: string) => ({
      ...processedVideo(idFromPath(filePath)),
      dataUrl: `data:video/mp4;base64,${largePayload}${idFromPath(filePath)}`,
    }));
    mocks.createMediaEmbeddings.mockImplementation(async ({ media }: { media: EmbeddingMediaInput[] }) =>
      media.map((_, index) => ({ embedding: [index + 1, 0, 0], model: config.model }))
    );

    const result = await batchComputeEmbeddings({ batchSize: posts.length });

    expect(result).toEqual({ processed: 4, succeeded: 4, failed: 0 });
    const requests = mocks.createMediaEmbeddings.mock.calls.map(([call]) => call.media as EmbeddingMediaInput[]);
    expect(requests.map((media) => media.map(({ type }) => type))).toEqual([
      ["video", "image"],
      ["video", "image"],
    ]);
    for (const media of requests) {
      const bytes = media.reduce((sum, item) => sum + item.dataUrl.length, 0);
      expect(bytes).toBeLessThanOrEqual(requestBudgetBytes);
    }
  });
});

