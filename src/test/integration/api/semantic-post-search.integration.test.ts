import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from "../setup";
import { setTestPrisma } from "@/lib/db";
import { createPost } from "../factories";
import { getPostEmbeddingVector, upsertCompleteEmbedding } from "@/lib/embeddings/store";
import { searchSemanticPostsByPostHash } from "@/lib/search";

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

async function embedPost(postId: number, vector: number[]) {
  await upsertCompleteEmbedding({
    postId,
    config,
    embedding: vector,
    sourceWidth: 100,
    sourceHeight: 100,
    processedWidth: 100,
    processedHeight: 100,
  });
}

describe("post-based semantic search", () => {
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

  it("reads back a post's stored embedding for the active config", async () => {
    const prisma = getTestPrisma();
    const post = await createPost(prisma, { mimeType: "image/png", extension: ".png" });
    await embedPost(post.id, embedding(1, 0));

    const source = await getPostEmbeddingVector({ hash: post.hash, config });

    expect(source?.postId).toBe(post.id);
    expect(source?.embedding.slice(0, 2)).toEqual([1, 0]);
  });

  it("returns null when the post has no embedding for the active config", async () => {
    const prisma = getTestPrisma();
    const post = await createPost(prisma, { mimeType: "image/png", extension: ".png" });

    expect(await getPostEmbeddingVector({ hash: post.hash, config })).toBeNull();
    expect(
      await getPostEmbeddingVector({ hash: post.hash, config: { ...config, model: "other/model" } })
    ).toBeNull();
  });

  it("ranks neighbors by cosine distance and excludes the source post", async () => {
    const prisma = getTestPrisma();
    await seedEmbeddingSettings();
    const source = await createPost(prisma, { mimeType: "image/png", extension: ".png" });
    const close = await createPost(prisma, { mimeType: "image/png", extension: ".png" });
    const far = await createPost(prisma, { mimeType: "image/png", extension: ".png" });

    await embedPost(source.id, embedding(1, 0));
    await embedPost(close.id, embedding(0.9, 0.1));
    await embedPost(far.id, embedding(0, 1));

    const result = await searchSemanticPostsByPostHash(source.hash, 1);

    expect(result.notFound).toBeUndefined();
    // The source post is excluded even though it is the nearest vector to itself.
    expect(result.totalCount).toBe(2);
    expect(result.posts.map((post) => post.id)).toEqual([close.id, far.id]);
    expect(result.posts.map((post) => post.id)).not.toContain(source.id);
  });

  it("reports notFound when the source post was never embedded", async () => {
    const prisma = getTestPrisma();
    await seedEmbeddingSettings();
    const post = await createPost(prisma, { mimeType: "image/png", extension: ".png" });

    const result = await searchSemanticPostsByPostHash(post.hash, 1);

    expect(result.notFound).toBe(true);
    expect(result.posts).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  it("reports notFound when the embedding model changed after the post was embedded", async () => {
    const prisma = getTestPrisma();
    await seedEmbeddingSettings();
    const post = await createPost(prisma, { mimeType: "image/png", extension: ".png" });
    await embedPost(post.id, embedding(1, 0));

    await prisma.settings.update({
      where: { key: "openrouter.embedding.model" },
      data: { value: "another/model-v2" },
    });

    const result = await searchSemanticPostsByPostHash(post.hash, 1);
    expect(result.notFound).toBe(true);
  });
});
