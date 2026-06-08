import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  prepareImageQueryEmbedding: vi.fn(),
  searchSemanticPostsByImageHash: vi.fn(),
  checkApiRateLimit: vi.fn(),
}));

vi.mock("@/lib/search", () => ({
  prepareImageQueryEmbedding: mocks.prepareImageQueryEmbedding,
  searchSemanticPostsByImageHash: mocks.searchSemanticPostsByImageHash,
  MAX_PAGE: 10000,
  SEMANTIC_SEARCH_RATE_LIMIT_CONFIG: { prefix: "posts-semantic-search", limit: 30, windowMs: 60000 },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: mocks.checkApiRateLimit,
}));

vi.mock("@/lib/embeddings/image", () => ({
  EMBEDDING_SUPPORTED_MIMES: new Set(["image/png", "image/jpeg", "image/webp"]),
}));

import { GET, POST } from "./route";

const VALID_HASH = "a".repeat(64);

function postRequest(body: BodyInit | null): NextRequest {
  return new NextRequest("https://nextbooru.local/api/posts/semantic-search/image", {
    method: "POST",
    body,
  });
}

function formWithFile(bytes: Uint8Array, type: string, name = "q.png"): FormData {
  const form = new FormData();
  form.append("file", new File([bytes], name, { type }));
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkApiRateLimit.mockReturnValue(null);
  mocks.prepareImageQueryEmbedding.mockResolvedValue({ imageHash: VALID_HASH });
  mocks.searchSemanticPostsByImageHash.mockResolvedValue({
    posts: [],
    totalCount: 0,
    totalPages: 0,
    queryTimeMs: 1,
  });
});

describe("POST /api/posts/semantic-search/image", () => {
  it("embeds the uploaded image and returns its hash", async () => {
    const res = await POST(postRequest(formWithFile(new Uint8Array([1, 2, 3]), "image/png")));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ imageHash: VALID_HASH });
    expect(mocks.prepareImageQueryEmbedding).toHaveBeenCalledTimes(1);
  });

  it("rejects a request with no file", async () => {
    const res = await POST(postRequest(new FormData()));
    expect(res.status).toBe(400);
    expect(mocks.prepareImageQueryEmbedding).not.toHaveBeenCalled();
  });

  it("rejects an unsupported mime type with 415", async () => {
    const res = await POST(postRequest(formWithFile(new Uint8Array([1]), "image/gif", "q.gif")));
    expect(res.status).toBe(415);
    expect(mocks.prepareImageQueryEmbedding).not.toHaveBeenCalled();
  });

  it("rejects an oversized file with 413", async () => {
    const big = new Uint8Array(21 * 1024 * 1024);
    const res = await POST(postRequest(formWithFile(big, "image/png")));
    expect(res.status).toBe(413);
    expect(mocks.prepareImageQueryEmbedding).not.toHaveBeenCalled();
  });

  it("maps an unconfigured provider to 400", async () => {
    mocks.prepareImageQueryEmbedding.mockResolvedValueOnce({ error: "not configured", reason: "not_configured" });
    const res = await POST(postRequest(formWithFile(new Uint8Array([1]), "image/png")));
    expect(res.status).toBe(400);
  });

  it("maps an undecodable image to 422", async () => {
    mocks.prepareImageQueryEmbedding.mockResolvedValueOnce({ error: "bad image", reason: "invalid_image" });
    const res = await POST(postRequest(formWithFile(new Uint8Array([1]), "image/png")));
    expect(res.status).toBe(422);
  });

  it("maps an embedding failure to 502", async () => {
    mocks.prepareImageQueryEmbedding.mockResolvedValueOnce({ error: "boom", reason: "embed_failed" });
    const res = await POST(postRequest(formWithFile(new Uint8Array([1]), "image/png")));
    expect(res.status).toBe(502);
  });

  it("maps an unexpected embedding exception to 500", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.prepareImageQueryEmbedding.mockRejectedValueOnce(new Error("database unavailable"));

    try {
      const res = await POST(postRequest(formWithFile(new Uint8Array([1]), "image/png")));

      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toEqual({ error: "Failed to prepare image search" });
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("returns the rate-limit response when throttled", async () => {
    const limited = new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 });
    mocks.checkApiRateLimit.mockReturnValueOnce(limited);
    const res = await POST(postRequest(formWithFile(new Uint8Array([1]), "image/png")));
    expect(res.status).toBe(429);
    expect(mocks.prepareImageQueryEmbedding).not.toHaveBeenCalled();
  });
});

describe("GET /api/posts/semantic-search/image", () => {
  function getRequest(params: Record<string, string>): NextRequest {
    const url = new URL("https://nextbooru.local/api/posts/semantic-search/image");
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return new NextRequest(url);
  }

  it("returns ranked results for a valid hash", async () => {
    mocks.searchSemanticPostsByImageHash.mockResolvedValueOnce({
      posts: [{ id: 1, hash: VALID_HASH, width: 1, height: 1, blurhash: null, mimeType: "image/png", distance: 0.1, score: 0.9 }],
      totalCount: 1,
      totalPages: 1,
      queryTimeMs: 2,
    });
    const res = await GET(getRequest({ hash: VALID_HASH, page: "1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.totalCount).toBe(1);
    expect(data.posts).toHaveLength(1);
  });

  it("passes over-limit pages through so the search helper can reject them", async () => {
    const res = await GET(getRequest({ hash: VALID_HASH, page: "100000" }));

    expect(res.status).toBe(200);
    expect(mocks.searchSemanticPostsByImageHash).toHaveBeenCalledWith(
      VALID_HASH,
      100000,
      { limit: 48, minScore: undefined }
    );
  });

  it("rejects a malformed hash with 400", async () => {
    const res = await GET(getRequest({ hash: "nope" }));
    expect(res.status).toBe(400);
    expect(mocks.searchSemanticPostsByImageHash).not.toHaveBeenCalled();
  });

  it("returns 404 when the cached embedding is gone", async () => {
    mocks.searchSemanticPostsByImageHash.mockResolvedValueOnce({
      posts: [],
      totalCount: 0,
      totalPages: 0,
      queryTimeMs: 1,
      notFound: true,
    });
    const res = await GET(getRequest({ hash: VALID_HASH }));
    expect(res.status).toBe(404);
  });

  it("maps a search error to 400", async () => {
    mocks.searchSemanticPostsByImageHash.mockResolvedValueOnce({
      posts: [],
      totalCount: 0,
      totalPages: 0,
      queryTimeMs: 1,
      error: "Failed to search image embeddings",
    });
    const res = await GET(getRequest({ hash: VALID_HASH }));
    expect(res.status).toBe(400);
  });
});
