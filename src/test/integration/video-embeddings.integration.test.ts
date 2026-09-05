import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from "./setup";
import { setTestPrisma } from "@/lib/db";
import { createPost } from "./factories";
import {
  clearEmbeddingsForConfig,
  countPendingEmbeddings,
  deleteFailedEmbeddingsForConfig,
  findEmbeddingPostsToProcess,
  getEmbeddingStats,
  getPostEmbeddingVector,
  searchPostsByEmbedding,
  upsertCompleteEmbedding,
  upsertFailedEmbedding,
} from "@/lib/embeddings/store";

const config = {
  baseUrl: "https://openrouter.ai/api/v1",
  model: "google/gemini-embedding-2-preview",
  dimensions: 768,
  imageMaxResolution: 1024,
  videoEnabled: true,
};
const embedding = Array.from({ length: config.dimensions }, (_, index) => index === 0 ? 1 : 0);

async function complete(postId: number, active = config) {
  await upsertCompleteEmbedding({
    postId, config: active, embedding,
    sourceWidth: 100, sourceHeight: 100, processedWidth: 100, processedHeight: 100,
  });
}

describe("video embedding identity", () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);
  });
  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });
  beforeEach(cleanDatabase);

  it("reuses videos across image resolutions, keeps them searchable when disabled, and clears the active store", async () => {
    const prisma = getTestPrisma();
    const video = await createPost(prisma, { mimeType: "video/mp4", extension: ".mp4" });
    const failed = await createPost(prisma, { mimeType: "video/webm", extension: ".webm" });
    const image = await createPost(prisma, { mimeType: "image/png", extension: ".png" });
    await complete(video.id);
    await complete(image.id);
    await upsertFailedEmbedding({ postId: failed.id, config, errorMessage: "provider failed" });

    const changed = { ...config, imageMaxResolution: 2048 };
    expect(await countPendingEmbeddings(changed, false)).toBe(1);
    expect(await findEmbeddingPostsToProcess({ config: changed, retryFailed: false, take: 10 }))
      .toMatchObject([{ id: image.id }]);
    expect(await findEmbeddingPostsToProcess({ config: changed, retryFailed: true, take: 10 }))
      .toMatchObject([{ id: failed.id }]);
    expect(await getPostEmbeddingVector({ hash: image.hash, config: changed })).toBeNull();
    expect(await getPostEmbeddingVector({ hash: video.hash, config: changed }))
      .toEqual({ postId: video.id, embedding });

    await complete(failed.id, changed);
    expect(await countPendingEmbeddings(config, true)).toBe(0);
    // Repeating a write under another image resolution must update, not duplicate.
    await complete(video.id, changed);
    expect(await prisma.postEmbedding.count({ where: { postId: video.id } })).toBe(1);

    const disabled = { ...changed, videoEnabled: false };
    const results = await searchPostsByEmbedding({ config: disabled, embedding, skip: 0, limit: 10 });
    expect(results.posts.map((post) => post.id).sort()).toEqual([video.id, failed.id].sort());
    expect(await getEmbeddingStats(disabled)).toMatchObject({ embedded: 2, pending: 1, failed: 0 });
    expect(await getPostEmbeddingVector({ hash: video.hash, config: { ...changed, model: "other-model" } })).toBeNull();
    expect(await getPostEmbeddingVector({ hash: video.hash, config: { ...changed, baseUrl: "https://other.test/v1" } })).toBeNull();

    await upsertFailedEmbedding({ postId: failed.id, config: changed, errorMessage: "provider failed again" });
    expect(await deleteFailedEmbeddingsForConfig(disabled)).toBe(1);
    expect(await clearEmbeddingsForConfig(disabled)).toBe(1);
    expect(await getPostEmbeddingVector({ hash: video.hash, config })).toBeNull();
    expect(await getPostEmbeddingVector({ hash: image.hash, config })).toEqual({ postId: image.id, embedding });
  });
});
