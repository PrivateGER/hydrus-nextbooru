import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from "../setup";
import { setTestPrisma } from "@/lib/db";
import { createPost } from "../factories";
import {
  batchComputeImageEmbeddings,
  getCurrentEmbeddingStats,
} from "@/lib/embeddings/batch";
import {
  countPendingEmbeddings,
  findEmbeddingPostsToProcess,
  upsertCompleteEmbedding,
  upsertFailedEmbedding,
} from "@/lib/embeddings/store";

vi.mock("@/lib/auth", () => ({
  verifyAdminSession: vi.fn().mockResolvedValue({ authorized: true }),
}));

let GET: typeof import("@/app/api/admin/embeddings/route").GET;
let PUT: typeof import("@/app/api/admin/embeddings/route").PUT;
let DELETE: typeof import("@/app/api/admin/embeddings/route").DELETE;

const dimensions = 768;
const config = {
  baseUrl: "https://openrouter.ai/api/v1",
  model: "google/gemini-embedding-2-preview",
  dimensions,
  imageMaxResolution: 1024,
};

function embedding(): number[] {
  return [1, 0, ...Array.from({ length: dimensions - 2 }, () => 0)];
}

describe("/api/admin/embeddings", () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);
    const routeModule = await import("@/app/api/admin/embeddings/route");
    GET = routeModule.GET;
    PUT = routeModule.PUT;
    DELETE = routeModule.DELETE;
  });

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  it("returns settings, VectorChord extension status, and active config counts", async () => {
    const prisma = getTestPrisma();
    const completePost = await createPost(prisma, { mimeType: "image/png", extension: ".png" });
    const failedPost = await createPost(prisma, { mimeType: "image/jpeg", extension: ".jpg" });
    await createPost(prisma, { mimeType: "image/webp", extension: ".webp" });
    await createPost(prisma, { mimeType: "video/mp4", extension: ".mp4" });

    await upsertCompleteEmbedding({
      postId: completePost.id,
      config,
      embedding: embedding(),
      sourceWidth: 100,
      sourceHeight: 100,
      processedWidth: 100,
      processedHeight: 100,
    });
    await upsertFailedEmbedding({
      postId: failedPost.id,
      config,
      errorMessage: "provider failed",
    });

    await prisma.settings.createMany({
      data: [
        { key: "openrouter.embedding.model", value: config.model },
        { key: "openrouter.embedding.dimensions", value: String(config.dimensions) },
        { key: "openrouter.embedding.imageMaxResolution", value: String(config.imageMaxResolution) },
      ],
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.stats).toMatchObject({
      supported: 3,
      embedded: 1,
      failed: 1,
      pending: 1,
      unsupported: 1,
    });
    expect(data.stats.extensions.vector).toEqual(expect.any(String));
    expect(data.stats.extensions.vchord).toEqual(expect.any(String));
  });

  it("updates embedding settings", async () => {
    const request = new NextRequest("http://localhost/api/admin/embeddings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: "sk-or-v1-test",
        baseUrl: "https://openrouter.ai/api/v1",
        model: config.model,
        dimensions: 1536,
        imageMaxResolution: 1536,
      }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(200);

    const prisma = getTestPrisma();
    const rows = await prisma.settings.findMany();
    const values = new Map(rows.map((row) => [row.key, row.value]));

    expect(values.get("openrouter.apiKey")).toBe("sk-or-v1-test");
    expect(values.get("openrouter.baseUrl")).toBe("https://openrouter.ai/api/v1");
    expect(values.get("openrouter.embedding.dimensions")).toBe("1536");
    expect(values.get("openrouter.embedding.imageMaxResolution")).toBe("1536");
  });

  it("clears a stored embedding API key when an empty key is submitted", async () => {
    const prisma = getTestPrisma();
    await prisma.settings.create({ data: { key: "openrouter.apiKey", value: "sk-or-v1-old" } });

    const request = new NextRequest("http://localhost/api/admin/embeddings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "  " }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(200);

    const row = await prisma.settings.findUniqueOrThrow({ where: { key: "openrouter.apiKey" } });
    expect(row.value).toBe("");
  });

  it("redacts raw API keys from the current stats helper", async () => {
    const prisma = getTestPrisma();
    await prisma.settings.createMany({
      data: [
        { key: "openrouter.apiKey", value: "sk-or-v1-secret" },
        { key: "openrouter.embedding.model", value: config.model },
        { key: "openrouter.embedding.dimensions", value: String(config.dimensions) },
        { key: "openrouter.embedding.imageMaxResolution", value: String(config.imageMaxResolution) },
      ],
    });

    const result = await getCurrentEmbeddingStats();

    expect(result.settings).not.toHaveProperty("apiKey");
    expect(result.settings.apiKeyConfigured).toBe(true);
    expect(result.settings.maskedApiKey).not.toBe("sk-or-v1-secret");
  });

  it("allows custom embedding backends without an API key", async () => {
    const prisma = getTestPrisma();
    await prisma.settings.createMany({
      data: [
        { key: "openrouter.baseUrl", value: "https://embeddings.example/v1" },
        { key: "openrouter.embedding.model", value: config.model },
        { key: "openrouter.embedding.dimensions", value: String(config.dimensions) },
        { key: "openrouter.embedding.imageMaxResolution", value: String(config.imageMaxResolution) },
      ],
    });

    await expect(batchComputeImageEmbeddings({ limit: 0 })).resolves.toEqual({
      processed: 0,
      succeeded: 0,
      failed: 0,
    });
  });

  it("clears embeddings for the active config only", async () => {
    const prisma = getTestPrisma();
    const activePost = await createPost(prisma, { mimeType: "image/png", extension: ".png" });
    const otherPost = await createPost(prisma, { mimeType: "image/png", extension: ".png" });

    await prisma.settings.createMany({
      data: [
        { key: "openrouter.embedding.model", value: config.model },
        { key: "openrouter.embedding.dimensions", value: String(config.dimensions) },
        { key: "openrouter.embedding.imageMaxResolution", value: String(config.imageMaxResolution) },
      ],
    });

    await upsertCompleteEmbedding({
      postId: activePost.id,
      config,
      embedding: embedding(),
      sourceWidth: 100,
      sourceHeight: 100,
      processedWidth: 100,
      processedHeight: 100,
    });
    await upsertCompleteEmbedding({
      postId: otherPost.id,
      config: { ...config, imageMaxResolution: 2048 },
      embedding: embedding(),
      sourceWidth: 100,
      sourceHeight: 100,
      processedWidth: 100,
      processedHeight: 100,
    });

    const request = new NextRequest("http://localhost/api/admin/embeddings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clearCurrent: true }),
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(1);
    expect(await prisma.postEmbedding.count()).toBe(1);
  });

  it("selects only failed embeddings when retrying failed rows", async () => {
    const prisma = getTestPrisma();
    const pendingPost = await createPost(prisma, { mimeType: "image/png", extension: ".png" });
    const failedPost = await createPost(prisma, { mimeType: "image/jpeg", extension: ".jpg" });
    const completePost = await createPost(prisma, { mimeType: "image/webp", extension: ".webp" });

    await upsertFailedEmbedding({
      postId: failedPost.id,
      config,
      errorMessage: "provider failed",
    });
    await upsertCompleteEmbedding({
      postId: completePost.id,
      config,
      embedding: embedding(),
      sourceWidth: 100,
      sourceHeight: 100,
      processedWidth: 100,
      processedHeight: 100,
    });

    await expect(countPendingEmbeddings(config, false)).resolves.toBe(1);
    await expect(countPendingEmbeddings(config, true)).resolves.toBe(1);

    const pendingPosts = await findEmbeddingPostsToProcess({
      config,
      retryFailed: false,
      take: 10,
    });
    const failedPosts = await findEmbeddingPostsToProcess({
      config,
      retryFailed: true,
      take: 10,
    });

    expect(pendingPosts.map((post) => post.id)).toEqual([pendingPost.id]);
    expect(failedPosts.map((post) => post.id)).toEqual([failedPost.id]);
  });
});
