import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computePhashFromBuffer, PHASH_SUPPORTED_MIMES } from "@/lib/phash";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { apiLog } from "@/lib/logger";

const DEFAULT_THRESHOLD = 10;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_UPLOAD_SIZE = 20 * 1024 * 1024; // 20MB

/**
 * Tight rate limit for anonymous image uploads.
 *
 * Each POST decodes an up-to-20MB image with sharp and computes a perceptual hash, which is CPU
 * and memory intensive. This is far cheaper to abuse than search, so the limit is deliberately
 * tighter than the search route (60/min) to bound the decode workload from any single client.
 */
const SIMILAR_UPLOAD_RATE_LIMIT_CONFIG = {
  prefix: "similar-upload",
  limit: 10,
  windowMs: 60 * 1000,
};

/**
 * Search for similar images by existing post hash.
 *
 * GET /api/similar?hash=<sha256>&threshold=10&limit=20
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const hash = searchParams.get("hash");
  const parsedThreshold = parseInt(searchParams.get("threshold") || String(DEFAULT_THRESHOLD), 10);
  const threshold = Number.isFinite(parsedThreshold) ? Math.min(64, Math.max(0, parsedThreshold)) : DEFAULT_THRESHOLD;
  const parsedLimit = parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(MAX_LIMIT, Math.max(1, parsedLimit)) : DEFAULT_LIMIT;

  if (!hash || !/^[a-fA-F0-9]{64}$/.test(hash)) {
    return NextResponse.json(
      { error: "Valid SHA256 hash required" },
      { status: 400 }
    );
  }

  try {
    const entry = await prisma.phashEntry.findUnique({
      where: { hash: hash.toLowerCase() },
      select: { phash: true },
    });

    if (!entry) {
      // Check if the post exists at all
      const postExists = await prisma.post.findUnique({
        where: { hash: hash.toLowerCase() },
        select: { id: true },
      });

      if (!postExists) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Post does not have a perceptual hash" },
        { status: 422 }
      );
    }

    const results = await findSimilarByPhash(entry.phash, threshold, limit, hash.toLowerCase());
    return NextResponse.json({ results, threshold, sourceHash: hash.toLowerCase() });
  } catch (error) {
    apiLog.error({ error: error instanceof Error ? error.message : String(error) }, "Similar search failed");
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

/**
 * Search for similar images by uploading an image.
 *
 * POST /api/similar (multipart/form-data with "file" field)
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = checkApiRateLimit(request, SIMILAR_UPLOAD_RATE_LIMIT_CONFIG);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const formData = await request.formData();
    const fileEntry = formData.get("file");

    if (!fileEntry || !(fileEntry instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const file = fileEntry;
    const parsedThreshold = parseInt(formData.get("threshold") as string || String(DEFAULT_THRESHOLD), 10);
    const threshold = Number.isFinite(parsedThreshold) ? Math.min(64, Math.max(0, parsedThreshold)) : DEFAULT_THRESHOLD;
    const parsedLimit = parseInt(formData.get("limit") as string || String(DEFAULT_LIMIT), 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(MAX_LIMIT, Math.max(1, parsedLimit)) : DEFAULT_LIMIT;

    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_UPLOAD_SIZE / 1024 / 1024}MB` },
        { status: 413 }
      );
    }

    if (!file.type || !PHASH_SUPPORTED_MIMES.has(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Supported formats: JPEG, PNG, WebP, GIF, BMP, TIFF, AVIF." },
        { status: 415 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const phash = await computePhashFromBuffer(buffer);

    if (phash === null) {
      return NextResponse.json(
        { error: "Could not compute perceptual hash from uploaded image" },
        { status: 422 }
      );
    }

    const results = await findSimilarByPhash(phash, threshold, limit);
    return NextResponse.json({ results, threshold });
  } catch (error) {
    apiLog.error({ error: error instanceof Error ? error.message : String(error) }, "Similar upload search failed");
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

/**
 * Find posts with similar perceptual hashes using Hamming distance.
 *
 * JOINs PhashEntry with Post for result data.
 * Uses PostgreSQL's bit_count() and XOR (#) for comparison.
 */
async function findSimilarByPhash(
  targetPhash: bigint,
  threshold: number,
  limit: number,
  excludeHash?: string
): Promise<Array<{
  id: number;
  hash: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  mimeType: string;
  distance: number;
}>> {
  type ResultRow = {
    id: number;
    hash: string;
    width: number | null;
    height: number | null;
    blurhash: string | null;
    mimeType: string;
    distance: bigint;
  };

  const results = excludeHash
    ? await prisma.$queryRaw<ResultRow[]>`
        SELECT p.id, p.hash, p.width, p.height, p.blurhash, p."mimeType",
               bit_count((pe.phash::BIT(64)) # (${targetPhash}::BIGINT::BIT(64))) AS distance
        FROM "PhashEntry" pe
        JOIN "Post" p ON p.hash = pe.hash
        WHERE pe.hash != ${excludeHash}
          AND bit_count((pe.phash::BIT(64)) # (${targetPhash}::BIGINT::BIT(64))) <= ${threshold}
        ORDER BY distance ASC, p.id ASC
        LIMIT ${limit}
      `
    : await prisma.$queryRaw<ResultRow[]>`
        SELECT p.id, p.hash, p.width, p.height, p.blurhash, p."mimeType",
               bit_count((pe.phash::BIT(64)) # (${targetPhash}::BIGINT::BIT(64))) AS distance
        FROM "PhashEntry" pe
        JOIN "Post" p ON p.hash = pe.hash
        WHERE bit_count((pe.phash::BIT(64)) # (${targetPhash}::BIGINT::BIT(64))) <= ${threshold}
        ORDER BY distance ASC, p.id ASC
        LIMIT ${limit}
      `;

  // Convert BigInt distance to number for JSON serialization
  return results.map((r) => ({
    ...r,
    distance: Number(r.distance),
  }));
}
