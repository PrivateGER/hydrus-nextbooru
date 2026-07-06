import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isOcrEnabled,
  scanPost,
  OcrFileMissingError,
  OcrServiceResponseError,
  OcrServiceUnavailableError,
} from "@/lib/ocr";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { TRANSLATE_RATE_LIMIT_CONFIG } from "@/lib/translation/rate-limit";
import { aiLog } from "@/lib/logger";

const HASH_PATTERN = /^[a-fA-F0-9]{64}$/;

interface OcrRequestBody {
  targetLang?: string;
}

/**
 * Scan a post's image via the OCR sidecar and translate the recognized text.
 * Public, shared translate rate limit. Idempotent: rescans replace regions.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  const rateLimitResponse = checkApiRateLimit(request, TRANSLATE_RATE_LIMIT_CONFIG);
  if (rateLimitResponse) return rateLimitResponse;

  if (!isOcrEnabled()) {
    return NextResponse.json(
      { error: "OCR service is not configured" },
      { status: 503 }
    );
  }

  const { hash: rawHash } = await params;
  if (!HASH_PATTERN.test(rawHash)) {
    return NextResponse.json({ error: "Invalid hash format" }, { status: 400 });
  }
  const hash = rawHash.toLowerCase();

  const parsed: unknown = await request.json().catch(() => null);
  const body: OcrRequestBody =
    parsed && typeof parsed === "object" ? parsed : {};
  const targetLang = typeof body.targetLang === "string" ? body.targetLang : undefined;

  const post = await prisma.post.findUnique({
    where: { hash },
    select: { id: true, hash: true, extension: true, mimeType: true },
  });
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }
  if (!post.mimeType.startsWith("image/")) {
    return NextResponse.json(
      { error: "OCR is only supported for images" },
      { status: 400 }
    );
  }

  try {
    const outcome = await scanPost(post, targetLang);
    return NextResponse.json({
      hash: post.hash,
      scannedAt: outcome.scannedAt,
      hasText: outcome.hasText,
      translationFailed: outcome.translationFailed,
      regions: outcome.regions,
    });
  } catch (error) {
    if (error instanceof OcrFileMissingError) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    if (error instanceof OcrServiceUnavailableError) {
      return NextResponse.json({ error: "OCR service unavailable" }, { status: 503 });
    }
    if (error instanceof OcrServiceResponseError) {
      return NextResponse.json({ error: "OCR service returned an error" }, { status: 502 });
    }
    aiLog.error(
      { hash, error: error instanceof Error ? error.message : String(error) },
      "OCR scan failed"
    );
    return NextResponse.json({ error: "OCR scan failed" }, { status: 500 });
  }
}
