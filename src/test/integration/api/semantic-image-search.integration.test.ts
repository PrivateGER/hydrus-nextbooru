import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from "../setup";
import { setTestPrisma } from "@/lib/db";
import { createPost } from "../factories";
import { upsertCompleteEmbedding } from "@/lib/embeddings/store";
import {
  getCachedImageQueryEmbedding,
  hashImageBytes,
  hashImageQueryCacheKey,
  upsertImageQueryEmbedding,
} from "@/lib/embeddings/image-query-cache";
import { upsertSemanticQueryEmbedding } from "@/lib/embeddings/query-cache";
import { searchSemanticPostsByImageHash } from "@/lib/search";

const dimensions = 768;
const config = {
  baseUrl: "https://openrouter.ai/api/v1",
  model: "google/gemini-embedding-2-preview",
  dimensions,
  imageMaxResolution: 1024,
};

function embedding(first: number, second: number): number[] {
  return [first, second, ...Array.from({ length: dimensions - 2 }, () => 0)];
}

const imageHash = hashImageBytes(Buffer.from("a query image payload"));

describe("image-based semantic search", () => {
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

  async function seedEmbeddingSettings() {
    await getTestPrisma().settings.createMany({
      data: [
        { key: "openrouter.apiKey", value: "sk-or-v1-test" },
        { key: "openrouter.embedding.model", value: config.model },
        { key: "openrouter.embedding.dimensions", value: String(config.dimensions) },
        { key: "openrouter.embedding.imageMaxResolution", value: String(config.imageMaxResolution) },
      ],
    });
  }

  it("round-trips a query-image embedding stored with a NULL query", async () => {
    await upsertImageQueryEmbedding({ imageHash, config, embedding: embedding(1, 0) });

    const cached = await getCachedImageQueryEmbedding(imageHash, config);
    expect(cached?.embedding.slice(0, 2)).toEqual([1, 0]);

    // The shared cache table stores image rows with a NULL text query.
    const rows = await getTestPrisma().semanticQueryEmbedding.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].query).toBeNull();
    expect(rows[0].queryHash).toBe(hashImageQueryCacheKey(imageHash, config.imageMaxResolution));
  });

  it("keeps image rows and text rows independent in the shared cache", async () => {
    await upsertImageQueryEmbedding({ imageHash, config, embedding: embedding(1, 0) });
    await upsertSemanticQueryEmbedding({ query: "blue sky", config, embedding: embedding(0, 1) });

    const imageCached = await getCachedImageQueryEmbedding(imageHash, config);
    expect(imageCached?.embedding.slice(0, 2)).toEqual([1, 0]);

    // An image lookup must never match the text row (guarded by `query IS NULL`).
    const textHashAsImage = await getCachedImageQueryEmbedding(
      hashImageBytes(Buffer.from("blue sky as bytes")),
      config
    );
    expect(textHashAsImage).toBeNull();
    expect(await getTestPrisma().semanticQueryEmbedding.count()).toBe(2);
  });

  it("scopes the image cache by embedding config", async () => {
    const otherBackend = { ...config, baseUrl: "https://embeddings.example/v1" };
    await upsertImageQueryEmbedding({ imageHash, config, embedding: embedding(1, 0) });

    expect(await getCachedImageQueryEmbedding(imageHash, config)).not.toBeNull();
    expect(await getCachedImageQueryEmbedding(imageHash, otherBackend)).toBeNull();
  });

  it("ranks posts by cosine distance to the cached query image", async () => {
    const prisma = getTestPrisma();
    await seedEmbeddingSettings();
    const closePost = await createPost(prisma, { mimeType: "image/png", extension: ".png" });
    const farPost = await createPost(prisma, { mimeType: "image/png", extension: ".png" });

    await upsertCompleteEmbedding({
      postId: closePost.id,
      config,
      embedding: embedding(1, 0),
      sourceWidth: 100,
      sourceHeight: 100,
      processedWidth: 100,
      processedHeight: 100,
    });
    await upsertCompleteEmbedding({
      postId: farPost.id,
      config,
      embedding: embedding(0, 1),
      sourceWidth: 100,
      sourceHeight: 100,
      processedWidth: 100,
      processedHeight: 100,
    });
    await upsertImageQueryEmbedding({ imageHash, config, embedding: embedding(1, 0) });

    const result = await searchSemanticPostsByImageHash(imageHash, 1);

    expect(result.notFound).toBeUndefined();
    expect(result.totalCount).toBe(2);
    expect(result.posts.map((post) => post.id)).toEqual([closePost.id, farPost.id]);
  });

  it("reports notFound when the query image was never embedded", async () => {
    await seedEmbeddingSettings();
    const result = await searchSemanticPostsByImageHash(imageHash, 1);

    expect(result.notFound).toBe(true);
    expect(result.posts).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  it("misses the cache when the embedding model changed after upload", async () => {
    const prisma = getTestPrisma();
    await seedEmbeddingSettings();
    await upsertImageQueryEmbedding({ imageHash, config, embedding: embedding(1, 0) });

    // Admin switches the embedding model after the image was embedded.
    await prisma.settings.update({
      where: { key: "openrouter.embedding.model" },
      data: { value: "another/model-v2" },
    });

    const result = await searchSemanticPostsByImageHash(imageHash, 1);
    expect(result.notFound).toBe(true);
  });

  it("misses the cache when image preprocessing resolution changed after upload", async () => {
    const prisma = getTestPrisma();
    await seedEmbeddingSettings();
    await upsertImageQueryEmbedding({ imageHash, config, embedding: embedding(1, 0) });

    // Admin switches only the preprocessing size after the image was embedded.
    await prisma.settings.update({
      where: { key: "openrouter.embedding.imageMaxResolution" },
      data: { value: "2048" },
    });

    const result = await searchSemanticPostsByImageHash(imageHash, 1);
    expect(result.notFound).toBe(true);
  });
});
