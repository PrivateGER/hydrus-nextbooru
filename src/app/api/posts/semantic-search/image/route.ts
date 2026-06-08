import { NextRequest, NextResponse } from "next/server";
import {
  prepareImageQueryEmbedding,
  searchSemanticPostsByImageHash,
  SEMANTIC_SEARCH_RATE_LIMIT_CONFIG,
} from "@/lib/search";
import { checkApiRateLimit, type ApiRateLimitConfig } from "@/lib/rate-limit";
import { EMBEDDING_SUPPORTED_MIMES } from "@/lib/embeddings/image";

/** Cap query-image uploads (matches the perceptual-hash reverse-search limit). */
const MAX_UPLOAD_SIZE = 20 * 1024 * 1024; // 20MB

const HASH_PATTERN = /^[a-f0-9]{64}$/;

/**
 * Paginated GETs only read cached vectors + the database (no embedding cost), so
 * they get a looser budget than the embedding POST.
 */
const IMAGE_SEARCH_PAGE_RATE_LIMIT: ApiRateLimitConfig = {
  prefix: "posts-semantic-image-search",
  limit: 120,
  windowMs: 60 * 1000,
};

/**
 * Embed an uploaded query image and cache its vector.
 *
 * Accepts `multipart/form-data` with a `file` field. Returns `{ imageHash }`; the
 * client then runs/paginates the actual search via GET so no image bytes ride in
 * a URL and follow-up pages reuse the cached vector.
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = checkApiRateLimit(request, SEMANTIC_SEARCH_RATE_LIMIT_CONFIG);
  if (rateLimitResponse) return rateLimitResponse;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data with a file field" }, { status: 400 });
  }

  const fileEntry = formData.get("file");
  if (!fileEntry || !(fileEntry instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  if (fileEntry.size === 0) {
    return NextResponse.json({ error: "Uploaded file is empty" }, { status: 400 });
  }

  if (fileEntry.size > MAX_UPLOAD_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_UPLOAD_SIZE / 1024 / 1024}MB` },
      { status: 413 }
    );
  }

  if (!fileEntry.type || !EMBEDDING_SUPPORTED_MIMES.has(fileEntry.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload a still image (JPEG, PNG, WebP, etc.)." },
      { status: 415 }
    );
  }

  let result: Awaited<ReturnType<typeof prepareImageQueryEmbedding>>;
  try {
    const buffer = Buffer.from(await fileEntry.arrayBuffer());
    result = await prepareImageQueryEmbedding(buffer);
  } catch (err) {
    console.error("Failed to prepare image search", err);
    return NextResponse.json({ error: "Failed to prepare image search" }, { status: 500 });
  }

  if ("error" in result) {
    // Misconfiguration is the caller's to fix (400); an undecodable upload is
    // unprocessable (422); an upstream embedding failure is a bad gateway (502).
    const status =
      result.reason === "not_configured" ? 400 : result.reason === "invalid_image" ? 422 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ imageHash: result.imageHash });
}

/**
 * Search posts by a previously embedded query image.
 *
 * Query parameters:
 * - `hash`: the 64-char image hash returned by POST
 * - `page`: page number (default 1, max 10000)
 * - `limit`: results per page (default 48, max 100)
 * - `minScore`: optional minimum cosine similarity score
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = checkApiRateLimit(request, IMAGE_SEARCH_PAGE_RATE_LIMIT);
  if (rateLimitResponse) return rateLimitResponse;

  const searchParams = request.nextUrl.searchParams;
  const hash = (searchParams.get("hash") || "").trim().toLowerCase();
  const parsedPage = parseInt(searchParams.get("page") || "1", 10);
  const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
  const limit = parseInt(searchParams.get("limit") || "48", 10);
  const minScoreParam = searchParams.get("minScore");
  const minScore = minScoreParam === null ? undefined : Number.parseFloat(minScoreParam);

  if (!HASH_PATTERN.test(hash)) {
    return NextResponse.json({ error: "Valid image hash required" }, { status: 400 });
  }

  const result = await searchSemanticPostsByImageHash(hash, page, { limit, minScore });

  if (result.notFound) {
    return NextResponse.json(
      { error: "This image search has expired. Upload the image again." },
      { status: 404 }
    );
  }

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    posts: result.posts,
    totalCount: result.totalCount,
    totalPages: result.totalPages,
  });
}
