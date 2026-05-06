import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from "../setup";
import { setTestPrisma } from "@/lib/db";
import { SourceType } from "@/generated/prisma/client";
import { createGroup, createPost, createPostsBulk } from "../factories";
import {
  findRelatedPostsByEmbedding,
  searchPostsByEmbedding,
  upsertCompleteEmbedding,
} from "@/lib/embeddings/store";
import {
  getCachedSemanticQueryEmbedding,
  upsertSemanticQueryEmbedding,
} from "@/lib/embeddings/query-cache";
import { searchSemanticPosts } from "@/lib/search";

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

  it("scopes stored image embeddings by backend URL", async () => {
    const prisma = getTestPrisma();
    const post = await createPost(prisma, { mimeType: "image/png", extension: ".png" });
    const otherBackend = { ...config, baseUrl: "https://embeddings.example/v1" };

    await upsertCompleteEmbedding({
      postId: post.id,
      config,
      embedding: embedding(1, 0),
      sourceWidth: 100,
      sourceHeight: 100,
      processedWidth: 100,
      processedHeight: 100,
    });
    await upsertCompleteEmbedding({
      postId: post.id,
      config: otherBackend,
      embedding: embedding(0, 1),
      sourceWidth: 100,
      sourceHeight: 100,
      processedWidth: 100,
      processedHeight: 100,
    });

    expect(await prisma.postEmbedding.count()).toBe(2);

    const defaultBackendResults = await searchPostsByEmbedding({
      config,
      embedding: embedding(1, 0),
      skip: 0,
      limit: 10,
    });
    const customBackendResults = await searchPostsByEmbedding({
      config: otherBackend,
      embedding: embedding(0, 1),
      skip: 0,
      limit: 10,
    });

    expect(defaultBackendResults.posts).toHaveLength(1);
    expect(customBackendResults.posts).toHaveLength(1);
    expect(defaultBackendResults.posts[0].distance).toBeCloseTo(0);
    expect(customBackendResults.posts[0].distance).toBeCloseTo(0);
  });

  it("filters embedding search results by minimum score", async () => {
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
      minScore: 0.25,
    });

    expect(result.totalCount).toBe(1);
    expect(result.posts.map((post) => post.id)).toEqual([closePost.id]);
  });

  it("caps semantic search to the top 288 nearest results", async () => {
    const prisma = getTestPrisma();
    const defaultPageSize = 48;
    const semanticResultCap = defaultPageSize * 6;
    const postIds = await createPostsBulk(prisma, semanticResultCap + 12, {
      mimeType: "image/png",
      extension: ".png",
    });

    for (let index = 0; index < postIds.length; index += 1) {
      await upsertCompleteEmbedding({
        postId: postIds[index],
        config,
        embedding: embedding(1, index / 100),
        sourceWidth: 100,
        sourceHeight: 100,
        processedWidth: 100,
        processedHeight: 100,
      });
    }

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

    const firstPage = await searchSemanticPosts("blue sky", 1);
    const lastCappedPage = await searchSemanticPosts("blue sky", 6);
    const overflowPage = await searchSemanticPosts("blue sky", 7);

    expect(firstPage.totalCount).toBe(semanticResultCap);
    expect(firstPage.totalPages).toBe(6);
    expect(firstPage.posts).toHaveLength(defaultPageSize);
    expect(firstPage.posts.map((post) => post.id)).toEqual(postIds.slice(0, defaultPageSize));
    expect(lastCappedPage.posts).toHaveLength(defaultPageSize);
    expect(lastCappedPage.posts.map((post) => post.id)).toEqual(
      postIds.slice(semanticResultCap - defaultPageSize, semanticResultCap)
    );
    expect(overflowPage.posts).toHaveLength(0);
    expect(overflowPage.totalCount).toBe(semanticResultCap);
    expect(global.fetch).toHaveBeenCalledTimes(1);
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

  it("applies group exclusion before the related candidate cap", async () => {
    const prisma = getTestPrisma();
    const sourcePost = await createPost(prisma, { mimeType: "image/png", extension: ".png" });
    const validPost = await createPost(prisma, { mimeType: "image/png", extension: ".png" });
    const sharedGroup = await createGroup(prisma, SourceType.PIXIV, "candidate-cap-shared-group");
    const groupedCandidateIds = await createPostsBulk(prisma, 201, {
      mimeType: "image/png",
      extension: ".png",
    });

    await prisma.postGroup.createMany({
      data: [
        { postId: sourcePost.id, groupId: sharedGroup.id, position: 0 },
        ...groupedCandidateIds.map((postId, index) => ({
          postId,
          groupId: sharedGroup.id,
          position: index + 1,
        })),
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
      postId: validPost.id,
      config,
      embedding: embedding(0, 1),
      sourceWidth: 100,
      sourceHeight: 100,
      processedWidth: 100,
      processedHeight: 100,
    });

    for (const [index, postId] of groupedCandidateIds.entries()) {
      await upsertCompleteEmbedding({
        postId,
        config,
        embedding: embedding(1, (index + 1) / 1000000),
        sourceWidth: 100,
        sourceHeight: 100,
        processedWidth: 100,
        processedHeight: 100,
      });
    }

    const related = await findRelatedPostsByEmbedding({
      hash: sourcePost.hash,
      config,
      limit: 10,
    });

    expect(related.map((post) => post.id)).toEqual([validPost.id]);
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
    const farPost = await createPost(prisma, { mimeType: "image/png", extension: ".png" });

    await upsertCompleteEmbedding({
      postId: post.id,
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
    expect(first.posts.map((result) => result.id)).toEqual([post.id, farPost.id]);
    expect(first.totalCount).toBe(2);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(await prisma.semanticQueryEmbedding.count()).toBe(1);

    await prisma.settings.delete({ where: { key: "openrouter.apiKey" } });

    const second = await searchSemanticPosts("blue sky", 1);
    expect(second.posts.map((result) => result.id)).toEqual([post.id, farPost.id]);
    expect(second.totalCount).toBe(2);
    expect(second.error).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const cached = await prisma.semanticQueryEmbedding.findMany();
    expect(cached).toHaveLength(1);
    expect(cached[0].query).toBe("blue sky");
  });

  it("scopes cached semantic query embeddings by backend URL", async () => {
    const otherBackend = { ...config, baseUrl: "https://embeddings.example/v1" };

    await upsertSemanticQueryEmbedding({
      query: " blue   sky ",
      config,
      embedding: embedding(1, 0),
    });
    await upsertSemanticQueryEmbedding({
      query: "blue sky",
      config: otherBackend,
      embedding: embedding(0, 1),
    });

    const defaultCached = await getCachedSemanticQueryEmbedding("blue sky", config);
    const customCached = await getCachedSemanticQueryEmbedding("blue sky", otherBackend);

    expect(defaultCached?.embedding.slice(0, 2)).toEqual([1, 0]);
    expect(customCached?.embedding.slice(0, 2)).toEqual([0, 1]);
    expect(await getTestPrisma().semanticQueryEmbedding.count()).toBe(2);
  });

  it("uses a custom embedding backend without requiring an API key", async () => {
    const prisma = getTestPrisma();
    const customConfig = { ...config, baseUrl: "https://embeddings.example/v1" };
    const post = await createPost(prisma, { mimeType: "image/png", extension: ".png" });

    await upsertCompleteEmbedding({
      postId: post.id,
      config: customConfig,
      embedding: embedding(1, 0),
      sourceWidth: 100,
      sourceHeight: 100,
      processedWidth: 100,
      processedHeight: 100,
    });

    await prisma.settings.createMany({
      data: [
        { key: "openrouter.baseUrl", value: customConfig.baseUrl },
        { key: "openrouter.embedding.model", value: customConfig.model },
        { key: "openrouter.embedding.dimensions", value: String(customConfig.dimensions) },
        { key: "openrouter.embedding.imageMaxResolution", value: String(customConfig.imageMaxResolution) },
      ],
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn().mockResolvedValue({
        object: "list",
        model: customConfig.model,
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

    const result = await searchSemanticPosts("blue sky", 1);
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(result.posts.map((item) => item.id)).toEqual([post.id]);
    expect(url).toBe("https://embeddings.example/v1/embeddings");
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
  });
});
