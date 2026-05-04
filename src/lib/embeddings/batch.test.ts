import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  batchComputeImageEmbeddings,
  MAX_EMBEDDING_BATCH_SIZE,
} from "@/lib/embeddings/batch";
import type { EmbeddingPostToProcess } from "@/lib/embeddings/store";

const mocks = vi.hoisted(() => {
  const state = {
    assertVectorExtensionsAvailable: vi.fn(),
    countPendingEmbeddings: vi.fn(),
    findEmbeddingPostsToProcess: vi.fn(),
    getEmbeddingOpenRouterSettings: vi.fn(),
    isEmbeddingProviderConfigured: vi.fn(),
    preprocessImageForEmbedding: vi.fn(),
    toEmbeddingConfig: vi.fn(),
    upsertCompleteEmbedding: vi.fn(),
    upsertFailedEmbedding: vi.fn(),
    createImageEmbedding: vi.fn(),
    createImageEmbeddings: vi.fn(),
  };

  function OpenRouterClient() {
    return {
      createImageEmbedding: state.createImageEmbedding,
      createImageEmbeddings: state.createImageEmbeddings,
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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("batchComputeImageEmbeddings", () => {
  beforeEach(() => {
    mocks.assertVectorExtensionsAvailable.mockResolvedValue(undefined);
    mocks.countPendingEmbeddings.mockResolvedValue(0);
    mocks.findEmbeddingPostsToProcess.mockResolvedValue([]);
    mocks.getEmbeddingOpenRouterSettings.mockResolvedValue({ apiKey: "or-key", ...config });
    mocks.isEmbeddingProviderConfigured.mockReturnValue(true);
    mocks.toEmbeddingConfig.mockReturnValue(config);
    mocks.preprocessImageForEmbedding.mockReset();
    mocks.upsertCompleteEmbedding.mockResolvedValue(undefined);
    mocks.upsertFailedEmbedding.mockResolvedValue(undefined);
    mocks.createImageEmbedding.mockReset();
    mocks.createImageEmbeddings.mockReset();
  });

  it("rejects batch sizes above the bounded in-memory batch limit", async () => {
    await expect(
      batchComputeImageEmbeddings({ batchSize: MAX_EMBEDDING_BATCH_SIZE + 1 })
    ).rejects.toThrow(`batchSize must be ${MAX_EMBEDDING_BATCH_SIZE} or less`);

    expect(mocks.assertVectorExtensionsAvailable).not.toHaveBeenCalled();
  });

  it("limits concurrent image preprocessing within a batch", async () => {
    const posts = [post(1), post(2), post(3), post(4), post(5)];
    let activePreprocesses = 0;
    let maxActivePreprocesses = 0;

    mocks.countPendingEmbeddings.mockResolvedValue(posts.length);
    mocks.findEmbeddingPostsToProcess.mockResolvedValue(posts);
    mocks.preprocessImageForEmbedding.mockImplementation(async (filePath: string) => {
      const id = Number(filePath.match(/hash-(\d+)/)?.[1] ?? 0);
      activePreprocesses++;
      maxActivePreprocesses = Math.max(maxActivePreprocesses, activePreprocesses);
      await wait(5);
      activePreprocesses--;
      return processedImage(id);
    });
    mocks.createImageEmbeddings.mockImplementation(async ({ imageUrls }: { imageUrls: string[] }) =>
      imageUrls.map((_, index) => ({ embedding: [index + 1, 0, 0], model: config.model }))
    );

    const result = await batchComputeImageEmbeddings({ batchSize: posts.length });

    expect(result).toEqual({ processed: posts.length, succeeded: posts.length, failed: 0 });
    expect(maxActivePreprocesses).toBeLessThanOrEqual(2);
    expect(mocks.preprocessImageForEmbedding).toHaveBeenCalledTimes(posts.length);
    expect(mocks.createImageEmbeddings).toHaveBeenCalledTimes(1);
  });

  it("keeps individual fallback embedding retries concurrency-limited", async () => {
    const posts = [post(1), post(2), post(3), post(4), post(5)];
    let activeFallbackRequests = 0;
    let maxActiveFallbackRequests = 0;

    mocks.countPendingEmbeddings.mockResolvedValue(posts.length);
    mocks.findEmbeddingPostsToProcess.mockResolvedValue(posts);
    mocks.preprocessImageForEmbedding.mockImplementation(async (filePath: string) => {
      const id = Number(filePath.match(/hash-(\d+)/)?.[1] ?? 0);
      return processedImage(id);
    });
    mocks.createImageEmbeddings.mockRejectedValue(new Error("backend rejected batched image input"));
    mocks.createImageEmbedding.mockImplementation(async () => {
      activeFallbackRequests++;
      maxActiveFallbackRequests = Math.max(maxActiveFallbackRequests, activeFallbackRequests);
      await wait(5);
      activeFallbackRequests--;
      return { embedding: [1, 0, 0], model: config.model };
    });

    const result = await batchComputeImageEmbeddings({ batchSize: posts.length });

    expect(result).toEqual({ processed: posts.length, succeeded: posts.length, failed: 0 });
    expect(maxActiveFallbackRequests).toBeLessThanOrEqual(2);
    expect(mocks.createImageEmbeddings).toHaveBeenCalledTimes(1);
    expect(mocks.createImageEmbedding).toHaveBeenCalledTimes(posts.length);
  });
});
