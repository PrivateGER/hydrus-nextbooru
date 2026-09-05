import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  findNearestByVector,
  findRelatedPostsByEmbeddingForPosts,
  getEmbeddingVectorsForPosts,
  getMaxSimilarityToReferences,
} from "./store";
import { aiLog } from "@/lib/logger";

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
  videoEnabled: false,
};

function getSqlText(query: unknown): string {
  if (Array.isArray(query)) return query.join("?");
  if (query && typeof query === "object") {
    const sql = query as { sql?: unknown; strings?: unknown };
    if (typeof sql.sql === "string") return sql.sql;
    if (Array.isArray(sql.strings)) return sql.strings.join("?");
  }
  throw new Error("Expected a Prisma SQL query");
}

describe("taste-cluster embedding queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses stored vectors into dimension-checked Float32Array rows", async () => {
    const storedVector = Array.from(
      { length: config.dimensions },
      (_, index) => (index - 10) / 100
    );
    mockQueryRaw.mockResolvedValueOnce([
      { postId: "42", embedding: JSON.stringify(storedVector) },
    ]);

    const rows = await getEmbeddingVectorsForPosts({
      postIds: [42],
      config,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].postId).toBe(42);
    expect(rows[0].vector).toBeInstanceOf(Float32Array);
    expect(rows[0].vector).toHaveLength(config.dimensions);
    expect(rows[0].vector[17]).toBeCloseTo(storedVector[17], 6);
  });

  it("rejects a stored vector with the wrong dimensions", async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { postId: 42, embedding: JSON.stringify([1, 0]) },
    ]);

    await expect(
      getEmbeddingVectorsForPosts({
        postIds: [42],
        config,
      })
    ).rejects.toThrow(`Expected ${config.dimensions} embedding dimensions, got 2`);
  });

  it("chunks post-vector reads at 500 ids", async () => {
    mockQueryRaw.mockResolvedValue([]);

    await getEmbeddingVectorsForPosts({
      postIds: Array.from({ length: 500 }, (_, index) => index + 1),
      config,
    });
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);

    mockQueryRaw.mockClear();
    await getEmbeddingVectorsForPosts({
      postIds: Array.from({ length: 501 }, (_, index) => index + 1),
      config,
    });
    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
  });

  it("clamps nearest-neighbor limits and maps raw similarity rows", async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { postId: "7", score: "0.875" },
    ]);

    const rows = await findNearestByVector({
      vector: Float32Array.from({ length: config.dimensions }, (_, index) =>
        index === 0 ? 1 : 0
      ),
      config,
      limit: 900,
    });

    expect(rows).toEqual([{ postId: 7, score: 0.875 }]);
    const queryArguments = mockQueryRaw.mock.calls[0];
    expect(queryArguments[queryArguments.length - 1]).toBe(500);
    const sqlText = getSqlText(queryArguments[0]);
    expect(sqlText).toContain("pe.dimensions = ?");
    expect(sqlText).toContain(`pe.status = 'COMPLETE'::"EmbeddingStatus"`);
    expect(sqlText.replaceAll("<=>", "")).not.toMatch(/<=?/);
  });

  it("skips empty max-similarity queries and maps grouped rows", async () => {
    await expect(
      getMaxSimilarityToReferences({
        candidateIds: [],
        referenceIds: [10],
        config,
      })
    ).resolves.toEqual(new Map());
    expect(mockQueryRaw).not.toHaveBeenCalled();

    mockQueryRaw.mockResolvedValueOnce([
      { postId: "20", similarity: "0.75" },
      { postId: 21, similarity: 0.5 },
    ]);
    const similarities = await getMaxSimilarityToReferences({
      candidateIds: [20, 21],
      referenceIds: [10, 11],
      config,
    });

    expect(similarities).toEqual(
      new Map([
        [20, 0.75],
        [21, 0.5],
      ])
    );
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it("chunks both sides of max-similarity queries and merges chunk maxima", async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ postId: 1, similarity: 0.4 }])
      .mockResolvedValueOnce([{ postId: 1, similarity: 0.9 }])
      .mockResolvedValueOnce([{ postId: 1001, similarity: 0.8 }])
      .mockResolvedValueOnce([{ postId: 1001, similarity: 0.3 }]);

    const similarities = await getMaxSimilarityToReferences({
      candidateIds: Array.from({ length: 1001 }, (_, index) => index + 1),
      referenceIds: Array.from({ length: 201 }, (_, index) => index + 2001),
      config,
    });

    expect(mockQueryRaw).toHaveBeenCalledTimes(4);
    expect(similarities).toEqual(
      new Map([
        [1, 0.9],
        [1001, 0.8],
      ])
    );
  });
});

describe("findRelatedPostsByEmbeddingForPosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects the whole call when any chunk fails, after logging the chunk's seeds", async () => {
    const logError = vi.spyOn(aiLog, "error").mockImplementation(() => {});
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

    await expect(
      findRelatedPostsByEmbeddingForPosts({
        postIds: Array.from({ length: 17 }, (_, index) => index + 1),
        config,
        limit: 25,
      })
    ).rejects.toThrow("database timeout");

    // Both chunks were issued (no serial short-circuit); a surviving chunk's
    // rows must not leak out as a partial result.
    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    expect(logError).toHaveBeenCalledWith(
      { seeds: "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16", error: "database timeout" },
      "Embedding related-post chunk failed"
    );
    logError.mockRestore();
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
