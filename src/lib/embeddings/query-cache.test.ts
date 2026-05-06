import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCachedSemanticQueryEmbedding,
  hashSemanticQuery,
  normalizeSemanticQuery,
  upsertSemanticQueryEmbedding,
} from "./query-cache";

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

describe("semantic query cache", () => {
  const config = {
    baseUrl: "https://openrouter.ai/api/v1",
    model: "embedding-model",
    dimensions: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRaw.mockResolvedValue([]);
    mockExecuteRaw.mockResolvedValue(1);
  });

  it("normalizes query whitespace before hashing", () => {
    const normalized = "red hair blue eyes";

    expect(normalizeSemanticQuery("  red\n hair\tblue   eyes  ")).toBe(normalized);
    expect(hashSemanticQuery(normalized)).toBe(
      createHash("sha256").update(normalized, "utf8").digest("hex")
    );
  });

  it("returns null when no cached row matches the query config", async () => {
    await expect(getCachedSemanticQueryEmbedding("red hair", config)).resolves.toBeNull();
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it("returns a validated cached embedding for the normalized query", async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        query: "red hair",
        embedding: "[0.1,0.2,0.3]",
      },
    ]);

    await expect(getCachedSemanticQueryEmbedding(" red   hair ", config)).resolves.toEqual({
      queryHash: hashSemanticQuery("red hair"),
      query: "red hair",
      embedding: [0.1, 0.2, 0.3],
    });
  });

  it("rejects cached vectors with unexpected dimensions", async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        query: "red hair",
        embedding: "[0.1,0.2]",
      },
    ]);

    await expect(getCachedSemanticQueryEmbedding("red hair", config)).rejects.toThrow(
      "Expected 3 embedding dimensions, got 2"
    );
  });

  it("normalizes, validates, and stores query embeddings", async () => {
    await expect(
      upsertSemanticQueryEmbedding({
        query: " red   hair ",
        config,
        embedding: [0.1, 0.2, 0.3],
      })
    ).resolves.toEqual({
      queryHash: hashSemanticQuery("red hair"),
      query: "red hair",
      embedding: [0.1, 0.2, 0.3],
    });
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
  });

  it("rejects embeddings with the wrong dimension before writing", async () => {
    await expect(
      upsertSemanticQueryEmbedding({
        query: "red hair",
        config,
        embedding: [0.1, 0.2],
      })
    ).rejects.toThrow("Expected 3 embedding dimensions, got 2");
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });
});
