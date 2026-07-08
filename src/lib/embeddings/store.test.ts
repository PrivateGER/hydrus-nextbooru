import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findRelatedPostsByEmbeddingForPosts } from "./store";

const { mockQueryRaw } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}));

const config = {
  baseUrl: "https://openrouter.ai/api/v1",
  model: "google/gemini-embedding-2-preview",
  dimensions: 768,
  imageMaxResolution: 1024,
};

describe("findRelatedPostsByEmbeddingForPosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("omits failed chunks while returning neighbors from surviving chunks", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockQueryRaw
      .mockRejectedValueOnce(new Error("database timeout"))
      .mockResolvedValueOnce([
        {
          sourceId: 17,
          id: 42,
          hash: "a".repeat(64),
          width: 100,
          height: 100,
          blurhash: null,
          mimeType: "image/png",
          distance: 0.25,
        },
      ]);

    const related = await findRelatedPostsByEmbeddingForPosts({
      postIds: Array.from({ length: 17 }, (_, index) => index + 1),
      config,
      limit: 25,
    });

    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    expect(related.has(1)).toBe(false);
    expect(related.get(17)).toEqual([
      {
        id: 42,
        hash: "a".repeat(64),
        width: 100,
        height: 100,
        blurhash: null,
        mimeType: "image/png",
        distance: 0.25,
        score: 0.75,
      },
    ]);
    expect(consoleError).toHaveBeenCalledWith(
      "Embedding related-post chunk failed for seeds 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16:",
      expect.any(Error)
    );
    consoleError.mockRestore();
  });

  it("returns an empty entry for embedded seeds with no related rows", async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        sourceId: 1,
        id: null,
        hash: null,
        width: null,
        height: null,
        blurhash: null,
        mimeType: null,
        distance: null,
      },
    ]);

    const related = await findRelatedPostsByEmbeddingForPosts({
      postIds: [1],
      config,
      limit: 5,
    });

    expect(related.get(1)).toEqual([]);
  });
});
