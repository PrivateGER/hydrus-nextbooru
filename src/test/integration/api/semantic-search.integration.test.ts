import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from "../setup";
import { setTestPrisma } from "@/lib/db";
import { SourceType } from "@/generated/prisma/client";
import { createGroup, createPost } from "../factories";
import {
  findRelatedPostsByEmbedding,
  searchPostsByEmbedding,
  upsertCompleteEmbedding,
} from "@/lib/embeddings/store";
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

  it("finds related posts from the source post embedding", async () => {
    const prisma = getTestPrisma();
    const sourcePost = await createPost(prisma, { mimeType: "image/png", extension: ".png" });
    const closePost = await createPost(prisma, { mimeType: "image/png", extension: ".png" });
    const farPost = await createPost(prisma, { mimeType: "image/png", extension: ".png" });
    const noEmbeddingPost = await createPost(prisma, { mimeType: "image/png", extension: ".png" });

    await upsertCompleteEmbedding({
      postId: sourcePost.id,
      config,
      embedding: embedding(1, 0),
      sourceWidth: 100,
      sourceHeight: 100,
      processedWidth: 100,
      processedHeight: 100,
    });
    await upsertCompleteEmbedding({
      postId: closePost.id,
      config,
      embedding: embedding(0.9, 0.1),
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

    const related = await findRelatedPostsByEmbedding({
      hash: sourcePost.hash,
      config,
      limit: 10,
    });

    expect(related.map((post) => post.id)).toEqual([closePost.id, farPost.id]);
    expect(related.map((post) => post.id)).not.toContain(sourcePost.id);
    expect(related.map((post) => post.id)).not.toContain(noEmbeddingPost.id);
    expect(related[0].distance).toBeLessThan(related[1].distance);
  });

  it("excludes embedding-related posts that share a group with the source post", async () => {
    const prisma = getTestPrisma();
    const sourcePost = await createPost(prisma, { mimeType: "image/png", extension: ".png" });
    const sharedGroupPost = await createPost(prisma, { mimeType: "image/png", extension: ".png" });
    const ungroupedPost = await createPost(prisma, { mimeType: "image/png", extension: ".png" });
    const unrelatedGroupPost = await createPost(prisma, { mimeType: "image/png", extension: ".png" });
    const sourceGroup = await createGroup(prisma, SourceType.PIXIV, "shared-source-group");
    const unrelatedGroup = await createGroup(prisma, SourceType.TWITTER, "unrelated-group");

    await prisma.postGroup.createMany({
      data: [
        { postId: sourcePost.id, groupId: sourceGroup.id, position: 0 },
        { postId: sharedGroupPost.id, groupId: sourceGroup.id, position: 1 },
        { postId: unrelatedGroupPost.id, groupId: unrelatedGroup.id, position: 0 },
      ],
    });

    await upsertCompleteEmbedding({
      postId: sourcePost.id,
      config,
      embedding: embedding(1, 0),
      sourceWidth: 100,
      sourceHeight: 100,
      processedWidth: 100,
      processedHeight: 100,
    });
    await upsertCompleteEmbedding({
      postId: sharedGroupPost.id,
      config,
      embedding: embedding(0.99, 0.01),
      sourceWidth: 100,
      sourceHeight: 100,
      processedWidth: 100,
      processedHeight: 100,
    });
    await upsertCompleteEmbedding({
      postId: ungroupedPost.id,
      config,
      embedding: embedding(0.9, 0.1),
      sourceWidth: 100,
      sourceHeight: 100,
      processedWidth: 100,
      processedHeight: 100,
    });
    await upsertCompleteEmbedding({
      postId: unrelatedGroupPost.id,
      config,
      embedding: embedding(0.8, 0.2),
      sourceWidth: 100,
      sourceHeight: 100,
      processedWidth: 100,
      processedHeight: 100,
    });

    const related = await findRelatedPostsByEmbedding({
      hash: sourcePost.hash,
      config,
      limit: 10,
    });

    expect(related.map((post) => post.id)).toEqual([ungroupedPost.id, unrelatedGroupPost.id]);
    expect(related.map((post) => post.id)).not.toContain(sharedGroupPost.id);
  });

  it("returns no embedding-related posts when the source post has no active embedding", async () => {
    const prisma = getTestPrisma();
    const sourcePost = await createPost(prisma, { mimeType: "image/png", extension: ".png" });
    const relatedPost = await createPost(prisma, { mimeType: "image/png", extension: ".png" });

    await upsertCompleteEmbedding({
      postId: relatedPost.id,
      config,
      embedding: embedding(1, 0),
      sourceWidth: 100,
      sourceHeight: 100,
      processedWidth: 100,
      processedHeight: 100,
    });

    await expect(findRelatedPostsByEmbedding({
      hash: sourcePost.hash,
      config,
      limit: 10,
    })).resolves.toEqual([]);
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
