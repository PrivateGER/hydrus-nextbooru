import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCachedImageQueryEmbedding,
  hashImageBytes,
  hashImageQueryCacheKey,
  upsertImageQueryEmbedding,
} from "./image-query-cache";

const { mockQueryRaw, mockExecuteRaw } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
  },
}));

describe("semantic image query cache", () => {
  const config = {
    baseUrl: "https://openrouter.ai/api/v1",
    model: "embedding-model",
    dimensions: 3,
    imageMaxResolution: 1024,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRaw.mockResolvedValue([]);
    mockExecuteRaw.mockResolvedValue(1);
  });

  it("hashes raw image bytes with sha256", () => {
    const bytes = Buffer.from([1, 2, 3, 4, 5]);
    expect(hashImageBytes(bytes)).toBe(
      createHash("sha256").update(bytes).digest("hex")
    );
  });

  it("produces identical hashes for identical byte content", () => {
    const a = Buffer.from("the same image bytes");
    const b = Buffer.from("the same image bytes");
    expect(hashImageBytes(a)).toBe(hashImageBytes(b));
  });

  it("scopes image query cache keys by preprocessing resolution", () => {
    const imageHash = hashImageBytes(Buffer.from("img"));

    expect(hashImageQueryCacheKey(imageHash, 1024)).not.toBe(
      hashImageQueryCacheKey(imageHash, 2048)
    );
  });

  it("returns null when no cached row matches the image config", async () => {
    const imageHash = hashImageBytes(Buffer.from("img"));
    await expect(getCachedImageQueryEmbedding(imageHash, config)).resolves.toBeNull();
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it("returns a validated cached embedding for the image hash", async () => {
    const imageHash = hashImageBytes(Buffer.from("img"));
    mockQueryRaw.mockResolvedValueOnce([{ embedding: "[0.1,0.2,0.3]" }]);

    await expect(getCachedImageQueryEmbedding(imageHash, config)).resolves.toEqual({
      imageHash,
      embedding: [0.1, 0.2, 0.3],
    });
  });

  it("rejects cached vectors with unexpected dimensions", async () => {
    const imageHash = hashImageBytes(Buffer.from("img"));
    mockQueryRaw.mockResolvedValueOnce([{ embedding: "[0.1,0.2]" }]);

    await expect(getCachedImageQueryEmbedding(imageHash, config)).rejects.toThrow(
      "Expected 3 embedding dimensions, got 2"
    );
  });

  it("validates and stores image query embeddings", async () => {
    const imageHash = hashImageBytes(Buffer.from("img"));
    await expect(
      upsertImageQueryEmbedding({
        imageHash,
        config,
        embedding: [0.1, 0.2, 0.3],
      })
    ).resolves.toEqual({
      imageHash,
      embedding: [0.1, 0.2, 0.3],
    });
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
  });

  it("rejects embeddings with the wrong dimension before writing", async () => {
    const imageHash = hashImageBytes(Buffer.from("img"));
    await expect(
      upsertImageQueryEmbedding({
        imageHash,
        config,
        embedding: [0.1, 0.2],
      })
    ).rejects.toThrow("Expected 3 embedding dimensions, got 2");
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  it("rejects malformed image hashes", async () => {
    await expect(getCachedImageQueryEmbedding("not-a-hash", config)).rejects.toThrow();
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});
