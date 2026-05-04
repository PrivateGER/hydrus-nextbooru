import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from "../setup";
import { setTestPrisma } from "@/lib/db";
import { createPost } from "../factories";
import { searchPostsByEmbedding, upsertCompleteEmbedding } from "@/lib/embeddings/store";

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
});
