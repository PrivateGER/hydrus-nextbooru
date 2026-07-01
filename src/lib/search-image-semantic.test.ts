import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalConsoleError = console.error;
let restoreConsoleError: (() => void) | undefined;

const mocks = vi.hoisted(() => {
  const state = {
    getEmbeddingOpenRouterSettings: vi.fn(),
    toEmbeddingConfig: vi.fn(),
    isEmbeddingProviderConfigured: vi.fn(),
    preprocessImageBufferForEmbedding: vi.fn(),
    getCachedImageQueryEmbedding: vi.fn(),
    upsertImageQueryEmbedding: vi.fn(),
    searchPostsByEmbedding: vi.fn(),
    getPostEmbeddingVector: vi.fn(),
    createImageEmbedding: vi.fn(),
  };

  function OpenRouterClient() {
    return { createImageEmbedding: state.createImageEmbedding };
  }

  return {
    ...state,
    OpenRouterClient: vi.fn(OpenRouterClient),
    OpenRouterConfigError: class OpenRouterConfigError extends Error {},
    OpenRouterApiError: class OpenRouterApiError extends Error {},
  };
});

vi.mock("@/lib/openrouter", () => ({
  OpenRouterClient: mocks.OpenRouterClient,
  OpenRouterConfigError: mocks.OpenRouterConfigError,
  OpenRouterApiError: mocks.OpenRouterApiError,
}));

vi.mock("@/lib/embeddings/settings", () => ({
  getEmbeddingOpenRouterSettings: mocks.getEmbeddingOpenRouterSettings,
  isEmbeddingProviderConfigured: mocks.isEmbeddingProviderConfigured,
  toEmbeddingConfig: mocks.toEmbeddingConfig,
}));

vi.mock("@/lib/embeddings/image", () => ({
  preprocessImageBufferForEmbedding: mocks.preprocessImageBufferForEmbedding,
  EMBEDDING_SUPPORTED_MIMES: new Set(["image/png", "image/jpeg"]),
}));

vi.mock("@/lib/embeddings/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/embeddings/store")>();
  return {
    ...actual,
    searchPostsByEmbedding: mocks.searchPostsByEmbedding,
    getPostEmbeddingVector: mocks.getPostEmbeddingVector,
  };
});

vi.mock("@/lib/embeddings/image-query-cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/embeddings/image-query-cache")>();
  return {
    ...actual,
    getCachedImageQueryEmbedding: mocks.getCachedImageQueryEmbedding,
    upsertImageQueryEmbedding: mocks.upsertImageQueryEmbedding,
  };
});

import {
  prepareImageQueryEmbedding,
  searchSemanticPostsByImageHash,
  searchSemanticPostsByPostHash,
} from "@/lib/search";
import { hashImageBytes } from "@/lib/embeddings/image-query-cache";

const config = {
  baseUrl: "https://openrouter.ai/api/v1",
  model: "google/gemini-embedding-2-preview",
  dimensions: 3,
  imageMaxResolution: 1024,
};

const processed = {
  dataUrl: "data:image/webp;base64,AAAA",
  sourceWidth: 100,
  sourceHeight: 100,
  processedWidth: 100,
  processedHeight: 100,
  byteLength: 1000,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Production code logs handled errors via console.error; silence the expected ones.
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  restoreConsoleError = () => consoleErrorSpy.mockRestore();
  mocks.getEmbeddingOpenRouterSettings.mockResolvedValue({ apiKey: "or-key", ...config });
  mocks.toEmbeddingConfig.mockReturnValue(config);
  mocks.isEmbeddingProviderConfigured.mockReturnValue(true);
  mocks.preprocessImageBufferForEmbedding.mockResolvedValue(processed);
  mocks.getCachedImageQueryEmbedding.mockResolvedValue(null);
  mocks.upsertImageQueryEmbedding.mockImplementation(async ({ imageHash, embedding }) => ({ imageHash, embedding }));
  mocks.createImageEmbedding.mockResolvedValue({ embedding: [1, 0, 0] });
  mocks.searchPostsByEmbedding.mockResolvedValue({ posts: [], totalCount: 0 });
  mocks.getPostEmbeddingVector.mockResolvedValue(null);
});

afterEach(() => {
  restoreConsoleError?.();
  restoreConsoleError = undefined;
});

afterAll(() => {
  expect(console.error).toBe(originalConsoleError);
});

describe("prepareImageQueryEmbedding", () => {
  const buffer = Buffer.from("an image payload");
  const expectedHash = hashImageBytes(buffer);

  it("embeds and caches a never-before-seen image, returning its hash", async () => {
    const result = await prepareImageQueryEmbedding(buffer);

    expect(result).toEqual({ imageHash: expectedHash });
    expect(mocks.preprocessImageBufferForEmbedding).toHaveBeenCalledWith(buffer, config.imageMaxResolution);
    expect(mocks.createImageEmbedding).toHaveBeenCalledTimes(1);
    expect(mocks.upsertImageQueryEmbedding).toHaveBeenCalledWith({
      imageHash: expectedHash,
      config: {
        baseUrl: config.baseUrl,
        model: config.model,
        dimensions: config.dimensions,
        imageMaxResolution: config.imageMaxResolution,
      },
      embedding: [1, 0, 0],
    });
  });

  it("short-circuits on a cache hit without calling the embedding provider", async () => {
    mocks.getCachedImageQueryEmbedding.mockResolvedValueOnce({ imageHash: expectedHash, embedding: [1, 0, 0] });

    const result = await prepareImageQueryEmbedding(buffer);

    expect(result).toEqual({ imageHash: expectedHash });
    expect(mocks.preprocessImageBufferForEmbedding).not.toHaveBeenCalled();
    expect(mocks.createImageEmbedding).not.toHaveBeenCalled();
    expect(mocks.upsertImageQueryEmbedding).not.toHaveBeenCalled();
  });

  it("reports a configuration error without embedding when the provider is unconfigured", async () => {
    mocks.isEmbeddingProviderConfigured.mockReturnValue(false);

    const result = await prepareImageQueryEmbedding(buffer);

    expect(result).toEqual({ error: expect.any(String), reason: "not_configured" });
    expect(mocks.createImageEmbedding).not.toHaveBeenCalled();
  });

  it("reports an embed failure and does not cache when the provider call throws", async () => {
    mocks.createImageEmbedding.mockRejectedValueOnce(new mocks.OpenRouterApiError("boom"));

    const result = await prepareImageQueryEmbedding(buffer);

    expect(result).toMatchObject({ reason: "embed_failed" });
    expect(mocks.upsertImageQueryEmbedding).not.toHaveBeenCalled();
  });

  it("reports an invalid-image failure when the image cannot be decoded", async () => {
    mocks.preprocessImageBufferForEmbedding.mockRejectedValueOnce(new Error("corrupt"));

    const result = await prepareImageQueryEmbedding(buffer);

    expect(result).toMatchObject({ reason: "invalid_image" });
    expect(mocks.createImageEmbedding).not.toHaveBeenCalled();
    expect(mocks.upsertImageQueryEmbedding).not.toHaveBeenCalled();
  });
});

describe("searchSemanticPostsByImageHash", () => {
  const imageHash = hashImageBytes(Buffer.from("an image payload"));

  it("returns notFound when no cached embedding exists for the hash", async () => {
    mocks.getCachedImageQueryEmbedding.mockResolvedValueOnce(null);

    const result = await searchSemanticPostsByImageHash(imageHash, 1);

    expect(result.notFound).toBe(true);
    expect(result.posts).toEqual([]);
    expect(mocks.searchPostsByEmbedding).not.toHaveBeenCalled();
  });

  it("runs a vector search against the cached embedding and paginates", async () => {
    mocks.getCachedImageQueryEmbedding.mockResolvedValueOnce({ imageHash, embedding: [1, 0, 0] });
    mocks.searchPostsByEmbedding.mockResolvedValueOnce({
      posts: [{ id: 7, hash: "a".repeat(64), width: 1, height: 1, blurhash: null, mimeType: "image/png", distance: 0.1, score: 0.9 }],
      totalCount: 1,
    });

    const result = await searchSemanticPostsByImageHash(imageHash, 2, { limit: 10 });

    expect(result.notFound).toBeUndefined();
    expect(result.totalCount).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.posts).toHaveLength(1);
    expect(mocks.searchPostsByEmbedding).toHaveBeenCalledWith(
      expect.objectContaining({ embedding: [1, 0, 0], skip: 10, limit: 10 })
    );
  });

  it("returns an empty result past the maximum page without querying", async () => {
    const result = await searchSemanticPostsByImageHash(imageHash, 100000);

    expect(result.posts).toEqual([]);
    expect(mocks.getCachedImageQueryEmbedding).not.toHaveBeenCalled();
    expect(mocks.searchPostsByEmbedding).not.toHaveBeenCalled();
  });
});

describe("searchSemanticPostsByPostHash", () => {
  const postHash = "b".repeat(64);

  it("returns notFound when the post has no embedding for the current config", async () => {
    mocks.getPostEmbeddingVector.mockResolvedValueOnce(null);

    const result = await searchSemanticPostsByPostHash(postHash, 1);

    expect(result.notFound).toBe(true);
    expect(result.posts).toEqual([]);
    expect(mocks.searchPostsByEmbedding).not.toHaveBeenCalled();
  });

  it("ranks neighbors against the post's stored vector, excluding the post itself", async () => {
    mocks.getPostEmbeddingVector.mockResolvedValueOnce({ postId: 42, embedding: [1, 0, 0] });
    mocks.searchPostsByEmbedding.mockResolvedValueOnce({
      posts: [{ id: 7, hash: "a".repeat(64), width: 1, height: 1, blurhash: null, mimeType: "image/png", distance: 0.1, score: 0.9 }],
      totalCount: 1,
    });

    const result = await searchSemanticPostsByPostHash(postHash, 2, { limit: 10 });

    expect(result.notFound).toBeUndefined();
    expect(result.totalCount).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.posts).toHaveLength(1);
    expect(mocks.getPostEmbeddingVector).toHaveBeenCalledWith(
      expect.objectContaining({ hash: postHash })
    );
    expect(mocks.searchPostsByEmbedding).toHaveBeenCalledWith(
      expect.objectContaining({ embedding: [1, 0, 0], skip: 10, limit: 10, excludePostId: 42 })
    );
  });

  it("returns an empty result past the maximum page without querying", async () => {
    const result = await searchSemanticPostsByPostHash(postHash, 100000);

    expect(result.posts).toEqual([]);
    expect(mocks.getPostEmbeddingVector).not.toHaveBeenCalled();
    expect(mocks.searchPostsByEmbedding).not.toHaveBeenCalled();
  });
});
