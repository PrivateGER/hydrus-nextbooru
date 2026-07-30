import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from "../setup";
import { setTestPrisma } from "@/lib/db";
import { createPostWithTags } from "../factories";
import { upsertCompleteEmbedding } from "@/lib/embeddings/store";
import {
  scoreCandidateTagSims,
  toTagEmbeddingConfig,
  upsertCompleteTagEmbedding,
} from "@/lib/embeddings/tag-store";
import { searchSemanticPosts } from "@/lib/search";

const dimensions = 768;
const config = {
  baseUrl: "https://openrouter.ai/api/v1",
  model: "google/gemini-embedding-2-preview",
  dimensions,
  imageMaxResolution: 1024,
};
const tagConfig = toTagEmbeddingConfig(config);

function embedding(first: number, second: number): number[] {
  return [first, second, ...Array.from({ length: dimensions - 2 }, () => 0)];
}

/** Unit vector at `sim` cosine similarity to embedding(1, 0). */
function embeddingAtSim(sim: number): number[] {
  return embedding(sim, Math.sqrt(1 - sim * sim));
}

async function seedSettings() {
  await getTestPrisma().settings.createMany({
    data: [
      { key: "openrouter.apiKey", value: "sk-or-v1-test" },
      { key: "openrouter.embedding.model", value: config.model },
      { key: "openrouter.embedding.dimensions", value: String(config.dimensions) },
      { key: "openrouter.embedding.imageMaxResolution", value: String(config.imageMaxResolution) },
    ],
  });
}

function mockQueryEmbeddingFetch() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    json: vi.fn().mockResolvedValue({
      object: "list",
      model: config.model,
      data: [{ object: "embedding", embedding: embedding(1, 0), index: 0 }],
    }),
    text: vi.fn(),
  } as unknown as Response);
}

async function seedImageEmbedding(postId: number, sim: number) {
  await upsertCompleteEmbedding({
    postId,
    config,
    embedding: embeddingAtSim(sim),
    sourceWidth: 100,
    sourceHeight: 100,
    processedWidth: 100,
    processedHeight: 100,
  });
}

async function seedTagEmbedding(tagName: string, vector: number[], targetConfig = tagConfig) {
  const tag = await getTestPrisma().tag.findFirstOrThrow({ where: { name: tagName } });
  await upsertCompleteTagEmbedding({ tagId: tag.id, config: targetConfig, embedding: vector });
}

describe("semantic search tag-embedding rerank", () => {
  const originalFetch = global.fetch;

  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);
  });

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("promotes a strong tag match over a slightly better image score, after the minScore floor", async () => {
    const prisma = getTestPrisma();
    // A: best image similarity, tags unrelated to the query.
    const postA = await createPostWithTags(prisma, ["landscape"], { mimeType: "image/png", extension: ".png" });
    // B: slightly worse image similarity, one tag that nails the query.
    const postB = await createPostWithTags(prisma, ["on back"], { mimeType: "image/png", extension: ".png" });
    // C: below the minScore floor — must be dropped BEFORE reranking.
    const postC = await createPostWithTags(prisma, ["on back"], { mimeType: "image/png", extension: ".png" });

    await seedImageEmbedding(postA.id, 0.97);
    await seedImageEmbedding(postB.id, 0.95);
    await seedImageEmbedding(postC.id, 0.9);

    // Tag vectors relative to the query embedding(1, 0): "on back" matches
    // perfectly, "landscape" is orthogonal (calibrates to 0).
    await seedTagEmbedding("on back", embedding(1, 0));
    await seedTagEmbedding("landscape", embedding(0, 1));

    await seedSettings();
    mockQueryEmbeddingFetch();

    const result = await searchSemanticPosts("girl lying on her back", 1, { minScore: 0.93 });

    expect(result.error).toBeUndefined();
    expect(result.totalCount).toBe(2);
    expect(result.posts.map((post) => post.id)).toEqual([postB.id, postA.id]);
    // Reranking permutes the window without rewriting the reported scores:
    // `score` stays the raw image cosine each post was retrieved with.
    expect(result.posts[0].score).toBeCloseTo(0.95, 2);
    expect(result.posts[1].score).toBeCloseTo(0.97, 2);
  });

  it("reranks the whole window before pagination so pages partition the same order", async () => {
    const prisma = getTestPrisma();
    const postA = await createPostWithTags(prisma, ["landscape"], { mimeType: "image/png", extension: ".png" });
    const postB = await createPostWithTags(prisma, ["on back"], { mimeType: "image/png", extension: ".png" });
    const postC = await createPostWithTags(prisma, ["scenery"], { mimeType: "image/png", extension: ".png" });

    await seedImageEmbedding(postA.id, 0.97);
    await seedImageEmbedding(postB.id, 0.95);
    await seedImageEmbedding(postC.id, 0.9);

    await seedTagEmbedding("on back", embedding(1, 0));
    await seedTagEmbedding("landscape", embedding(0, 1));
    await seedTagEmbedding("scenery", embedding(0, 1));

    await seedSettings();
    mockQueryEmbeddingFetch();

    const pages = [];
    for (let page = 1; page <= 3; page++) {
      const result = await searchSemanticPosts("girl lying on her back", page, { limit: 1 });
      expect(result.totalCount).toBe(3);
      pages.push(...result.posts.map((post) => post.id));
    }

    // Blended order: B (tag match beats A's small image lead), A, C.
    expect(pages).toEqual([postB.id, postA.id, postC.id]);
    // The query embedding is cached after page 1 — no re-embedding per page.
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps pure image-distance order when the tag vocabulary is not embedded for the active config", async () => {
    const prisma = getTestPrisma();
    const postA = await createPostWithTags(prisma, ["landscape"], { mimeType: "image/png", extension: ".png" });
    const postB = await createPostWithTags(prisma, ["on back"], { mimeType: "image/png", extension: ".png" });

    await seedImageEmbedding(postA.id, 0.97);
    await seedImageEmbedding(postB.id, 0.95);

    // A tag embedding under a DIFFERENT backend must not activate the rerank
    // for the active config.
    await seedTagEmbedding("on back", embedding(1, 0), {
      ...tagConfig,
      baseUrl: "https://embeddings.example/v1",
    });

    await seedSettings();
    mockQueryEmbeddingFetch();

    const result = await searchSemanticPosts("girl lying on her back", 1);

    expect(result.error).toBeUndefined();
    expect(result.posts.map((post) => post.id)).toEqual([postA.id, postB.id]);
  });

  it("cuts each candidate to its top-K best tags with exact similarities", async () => {
    const prisma = getTestPrisma();
    const post = await createPostWithTags(
      prisma,
      ["match a", "match b", "match c", "match d"],
      { mimeType: "image/png", extension: ".png" }
    );

    await seedTagEmbedding("match a", embeddingAtSim(0.99));
    await seedTagEmbedding("match b", embeddingAtSim(0.9));
    await seedTagEmbedding("match c", embeddingAtSim(0.8));
    await seedTagEmbedding("match d", embeddingAtSim(0.7));

    const sims = await scoreCandidateTagSims({
      config: tagConfig,
      embedding: embedding(1, 0),
      postIds: [post.id],
      topK: 3,
    });

    expect(sims).toHaveLength(3);
    expect(sims.every((entry) => entry.postId === post.id)).toBe(true);
    const values = sims.map((entry) => entry.sim).sort((a, b) => b - a);
    expect(values[0]).toBeCloseTo(0.99, 2);
    expect(values[1]).toBeCloseTo(0.9, 2);
    expect(values[2]).toBeCloseTo(0.8, 2);
  });
});
