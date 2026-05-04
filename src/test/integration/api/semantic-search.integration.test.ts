import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from "../setup";
import { setTestPrisma } from "@/lib/db";
import { createPost } from "../factories";
import { searchPostsByEmbedding, upsertCompleteEmbedding } from "@/lib/embeddings/store";
import { searchSemanticPosts } from "@/lib/search";

const dimensions = 768;
const config = {
  model: "google/gemini-embedding-2-preview",
  dimensions,
  imageMaxResolution: 1024,
};

function embedding(first: number, second: number): number[] {
  return [first, second, ...Array.from({ length: dimensions - 2 }, () => 0)];
}

describe("semantic image embedding search", () => {
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

  it("orders posts by cosine distance using VectorChord-compatible vectors", async () => {
    const prisma = getTestPrisma();
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

    const result = await searchPostsByEmbedding({
      config,
      embedding: embedding(1, 0),
      skip: 0,
      limit: 10,
    });

    expect(result.totalCount).toBe(2);
    expect(result.posts.map((post) => post.id)).toEqual([closePost.id, farPost.id]);
    expect(result.posts[0].distance).toBeLessThan(result.posts[1].distance);
  });

  it("caches semantic query embeddings by normalized query hash", async () => {
    const prisma = getTestPrisma();
    const post = await createPost(prisma, { mimeType: "image/png", extension: ".png" });

    await upsertCompleteEmbedding({
      postId: post.id,
      config,
      embedding: embedding(1, 0),
      sourceWidth: 100,
      sourceHeight: 100,
      processedWidth: 100,
      processedHeight: 100,
    });

    await prisma.settings.createMany({
      data: [
        { key: "openrouter.apiKey", value: "sk-or-v1-test" },
        { key: "openrouter.embedding.model", value: config.model },
        { key: "openrouter.embedding.dimensions", value: String(config.dimensions) },
        { key: "openrouter.embedding.imageMaxResolution", value: String(config.imageMaxResolution) },
      ],
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn().mockResolvedValue({
        object: "list",
        model: config.model,
        data: [
          {
            object: "embedding",
            embedding: embedding(1, 0),
            index: 0,
          },
        ],
      }),
      text: vi.fn(),
    } as unknown as Response);

    const first = await searchSemanticPosts(" blue   sky ", 1);
    expect(first.posts.map((result) => result.id)).toEqual([post.id]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(await prisma.semanticQueryEmbedding.count()).toBe(1);

    await prisma.settings.delete({ where: { key: "openrouter.apiKey" } });

    const second = await searchSemanticPosts("blue sky", 1);
    expect(second.posts.map((result) => result.id)).toEqual([post.id]);
    expect(second.error).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const cached = await prisma.semanticQueryEmbedding.findMany();
    expect(cached).toHaveLength(1);
    expect(cached[0].query).toBe("blue sky");
  });
});
