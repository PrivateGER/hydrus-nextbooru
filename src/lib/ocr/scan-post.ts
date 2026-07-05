import { readFile } from "fs/promises";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { buildFilePath } from "@/lib/hydrus/paths";
import { getOpenRouterClient, OpenRouterApiError } from "@/lib/openrouter";
import { aiLog } from "@/lib/logger";
import { scanImage } from "./client";
import { isOcrVisionContextEnabled, getOcrVisionContextSize } from "./config";
import { normalizeRegions } from "./normalize";
import { storeCrops } from "./crops";
import type { NormalizedRegion, OcrContextImage, OcrRegionDto } from "./types";

export interface ScannablePost {
  id: number;
  hash: string;
  extension: string;
  mimeType: string;
}

export interface ScanPostOutcome {
  hasText: boolean;
  translationFailed: boolean;
  scannedAt: Date;
  regions: OcrRegionDto[];
}

const cropWriteTails = new Map<string, Promise<void>>();

/**
 * Serialize crop-file replacement plus the matching DB transaction per post.
 * Batch-vs-manual rescans can otherwise interleave rm/write on the same crop
 * directory while a different transaction wins the database race.
 */
export async function withPostCropWriteLock<T>(hash: string, work: () => Promise<T>): Promise<T> {
  const key = hash.toLowerCase();
  const previous = cropWriteTails.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.catch(() => undefined).then(() => current);
  cropWriteTails.set(key, tail);

  await previous.catch(() => undefined);
  try {
    return await work();
  } finally {
    release();
    if (cropWriteTails.get(key) === tail) {
      cropWriteTails.delete(key);
    }
  }
}

/** The post's media file is missing/unreadable on disk. Maps to 404. */
export class OcrFileMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OcrFileMissingError";
  }
}

/** OCR regions plus the optional page image used as translation context. */
export interface OcrScanResult {
  regions: NormalizedRegion[];
  /** Downscaled page image for visual translation context, or null when disabled/empty. */
  contextImage: OcrContextImage | null;
}

/**
 * Detection + OCR for one post. Pure with respect to the DB.
 *
 * When `OCR_TRANSLATION_VISION_CONTEXT` is enabled and the page has text, a
 * downscaled JPEG of the page is returned so the translator can use visual
 * context; building it never fails the scan (falls back to null on error).
 *
 * @throws OcrFileMissingError | OcrServiceUnavailableError | OcrServiceResponseError
 */
export async function ocrPost(
  post: ScannablePost,
  options?: { signal?: AbortSignal }
): Promise<OcrScanResult> {
  const filePath = buildFilePath(post.hash, post.extension);
  let image: Buffer;
  try {
    image = await readFile(filePath);
  } catch {
    throw new OcrFileMissingError(`File not found for post ${post.hash}`);
  }

  const metadata = await sharp(image).metadata();
  if (!metadata.width || !metadata.height) {
    throw new OcrFileMissingError(`Cannot read dimensions for post ${post.hash}`);
  }
  if (metadata.orientation && metadata.orientation > 1) {
    // Known v1 limitation: sidecar coords are pre-rotation, browsers render
    // post-rotation. Rare for comics; surfaced in logs only.
    aiLog.warn(
      { hash: post.hash, orientation: metadata.orientation },
      "OCR on EXIF-rotated image; overlay boxes may be misaligned"
    );
  }

  const parsed = await scanImage(image, post.mimeType, { signal: options?.signal });
  const regions = normalizeRegions(parsed, { width: metadata.width, height: metadata.height });

  let contextImage: OcrContextImage | null = null;
  if (regions.length > 0 && isOcrVisionContextEnabled()) {
    try {
      const size = getOcrVisionContextSize();
      const data = await sharp(image)
        .rotate() // bake in EXIF orientation so the model sees upright pixels
        .resize(size, size, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      contextImage = { data, mimeType: "image/jpeg" };
    } catch (error) {
      aiLog.warn(
        { hash: post.hash, error: error instanceof Error ? error.message : String(error) },
        "Failed to build OCR vision context image; translating text-only"
      );
    }
  }

  return { regions, contextImage };
}

/**
 * Translate normalized regions. NEVER throws for transient/model failures: a
 * total failure yields failed=true and all-null translations so OCR results
 * are still persisted.
 *
 * A 401 from OpenRouter is a configuration problem, not a transient failure,
 * so it is rethrown for batch callers to abort on.
 *
 * @throws OpenRouterApiError when statusCode === 401
 */
export async function translateRegions(
  regions: NormalizedRegion[],
  targetLang?: string,
  contextImage?: OcrContextImage | null
): Promise<{ translated: (string | null)[]; targetLanguage: string | null; failed: boolean }> {
  if (regions.length === 0) {
    return { translated: [], targetLanguage: null, failed: false };
  }
  try {
    const client = await getOpenRouterClient();
    const result = await client.translateTexts({
      texts: regions.map((r) => r.ocrText),
      sourceLangs: regions.map((r) => r.sourceLanguage),
      targetLang,
      pageImage: contextImage
        ? { base64: contextImage.data.toString("base64"), mimeType: contextImage.mimeType }
        : undefined,
    });
    return { translated: result.translations, targetLanguage: result.targetLang, failed: false };
  } catch (error) {
    if (error instanceof OpenRouterApiError && error.statusCode === 401) {
      throw error;
    }
    aiLog.error(
      { error: error instanceof Error ? error.message : String(error), count: regions.length },
      "OCR region translation failed; persisting OCR text only"
    );
    return { translated: regions.map(() => null), targetLanguage: null, failed: true };
  }
}

/** Replace a post's regions and mark the scan COMPLETE, atomically. */
export async function persistScan(
  post: { id: number; hash: string },
  regions: NormalizedRegion[],
  translated: (string | null)[],
  targetLanguage: string | null,
  hasCrops: boolean[]
): Promise<ScanPostOutcome> {
  const scannedAt = new Date();
  const rows = regions.map((region, i) => ({
    postId: post.id,
    readingOrder: region.readingOrder,
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
    ocrText: region.ocrText,
    translatedText: translated[i] ?? null,
    sourceLanguage: region.sourceLanguage,
    targetLanguage: translated[i] != null ? targetLanguage : null,
    confidence: region.confidence,
    angle: region.angle,
    hasCrop: hasCrops[i] ?? false,
    textColorFg: region.textColorFg,
    textColorBg: region.textColorBg,
  }));

  const operations = [
    prisma.imageTextRegion.deleteMany({ where: { postId: post.id } }),
    ...(rows.length > 0 ? [prisma.imageTextRegion.createMany({ data: rows })] : []),
    prisma.post.update({
      where: { id: post.id },
      data: { ocrStatus: "COMPLETE", ocrScannedAt: scannedAt },
    }),
  ];
  await prisma.$transaction(operations);

  const cropVersion = scannedAt.getTime();
  return {
    hasText: rows.length > 0,
    translationFailed: rows.length > 0 && rows.every((row) => row.translatedText === null),
    scannedAt,
    regions: rows.map((row) => ({
      readingOrder: row.readingOrder,
      x: row.x,
      y: row.y,
      width: row.width,
      height: row.height,
      ocrText: row.ocrText,
      translatedText: row.translatedText,
      sourceLanguage: row.sourceLanguage,
      hasCrop: row.hasCrop,
      textColorFg: row.textColorFg,
      textColorBg: row.textColorBg,
      cropVersion,
    })),
  };
}

/** Record a scan failure without touching existing regions. */
export async function markScanFailed(postId: number): Promise<void> {
  await prisma.post.update({ where: { id: postId }, data: { ocrStatus: "FAILED" } });
}

/**
 * Full per-post pipeline: OCR -> translate -> persist.
 * Sidecar/file errors mark the post FAILED and rethrow for route mapping.
 * A 401 during translation is treated like any translation failure here: OCR
 * regions are persisted with null translations and translationFailed is true.
 */
export async function scanPost(post: ScannablePost, targetLang?: string): Promise<ScanPostOutcome> {
  let regions: NormalizedRegion[];
  let contextImage: OcrContextImage | null;
  try {
    ({ regions, contextImage } = await ocrPost(post));
  } catch (error) {
    await markScanFailed(post.id).catch(() => {});
    throw error;
  }

  try {
    const { translated, targetLanguage, failed } = await translateRegions(
      regions,
      targetLang,
      contextImage
    );
    const outcome = await withPostCropWriteLock(post.hash, async () => {
      const hasCrops = await storeCrops(post.hash, regions);
      return persistScan(post, regions, translated, targetLanguage, hasCrops);
    });
    return { ...outcome, translationFailed: failed && outcome.hasText };
  } catch (error) {
    if (error instanceof OpenRouterApiError && error.statusCode === 401) {
      const outcome = await withPostCropWriteLock(post.hash, async () => {
        const hasCrops = await storeCrops(post.hash, regions);
        return persistScan(post, regions, regions.map(() => null), null, hasCrops);
      });
      return { ...outcome, translationFailed: true };
    }
    throw error;
  }
}
