import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  searchSemanticPostsByPostHash: vi.fn(),
  checkApiRateLimit: vi.fn(),
}));

vi.mock("@/lib/search", () => ({
  searchSemanticPostsByPostHash: mocks.searchSemanticPostsByPostHash,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: mocks.checkApiRateLimit,
}));

import { GET } from "./route";

const VALID_HASH = "a".repeat(64);

function getRequest(params: Record<string, string>): NextRequest {
  const url = new URL("https://nextbooru.local/api/posts/semantic-search/post");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkApiRateLimit.mockReturnValue(null);
  mocks.searchSemanticPostsByPostHash.mockResolvedValue({
    posts: [],
    totalCount: 0,
    totalPages: 0,
    queryTimeMs: 1,
  });
});

describe("GET /api/posts/semantic-search/post", () => {
  it("returns ranked results for a valid post hash", async () => {
    mocks.searchSemanticPostsByPostHash.mockResolvedValueOnce({
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

  it("lowercases the hash and passes pagination through to the search helper", async () => {
    const res = await GET(getRequest({ hash: VALID_HASH.toUpperCase(), page: "3" }));

    expect(res.status).toBe(200);
    expect(mocks.searchSemanticPostsByPostHash).toHaveBeenCalledWith(
      VALID_HASH,
      3,
      { limit: 48, minScore: undefined }
    );
  });

  it("rejects a malformed hash with 400", async () => {
    const res = await GET(getRequest({ hash: "nope" }));
    expect(res.status).toBe(400);
    expect(mocks.searchSemanticPostsByPostHash).not.toHaveBeenCalled();
  });

  it("returns 404 when the post has no embedding for the current config", async () => {
    mocks.searchSemanticPostsByPostHash.mockResolvedValueOnce({
      posts: [],
      totalCount: 0,
      totalPages: 0,
      queryTimeMs: 1,
      notFound: true,
    });
    const res = await GET(getRequest({ hash: VALID_HASH }));
    expect(res.status).toBe(404);
  });

  it("maps a search error to 500", async () => {
    mocks.searchSemanticPostsByPostHash.mockResolvedValueOnce({
      posts: [],
      totalCount: 0,
      totalPages: 0,
      queryTimeMs: 1,
      error: "Failed to search image embeddings",
    });
    const res = await GET(getRequest({ hash: VALID_HASH }));
    expect(res.status).toBe(500);
  });

  it("returns the rate-limit response when throttled", async () => {
    const limited = new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 });
    mocks.checkApiRateLimit.mockReturnValueOnce(limited);
    const res = await GET(getRequest({ hash: VALID_HASH }));
    expect(res.status).toBe(429);
    expect(mocks.searchSemanticPostsByPostHash).not.toHaveBeenCalled();
  });
});
