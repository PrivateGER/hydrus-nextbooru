import { readFile } from "fs/promises";
import { prisma } from "@/lib/db";
import { buildFilePath } from "@/lib/hydrus/paths";
import { getOpenRouterClient, OpenRouterApiError } from "@/lib/openrouter";
import { aiLog } from "@/lib/logger";
import { renderInpaintedPage, scanImage } from "./client";
import { OcrServiceBusyError } from "./errors";
import { normalizeRegions } from "./normalize";
import { deleteInpaintedPage, storeInpaintedPage } from "./crops";
import { prepareSidecarImage } from "./image-prep";
import type { NormalizedRegion, OcrRegionDto } from "./types";

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

/**
 * Detection + OCR for one post. Pure with respect to the DB.
 *
 * @throws OcrFileMissingError | OcrServiceUnavailableError | OcrServiceResponseError
 */
export async function ocrPost(
  post: ScannablePost,
  options?: { signal?: AbortSignal }
): Promise<NormalizedRegion[]> {
  const filePath = buildFilePath(post.hash, post.extension);
  let image: Buffer;
  try {
    image = await readFile(filePath);
  } catch {
    throw new OcrFileMissingError(`File not found for post ${post.hash}`);
  }

  const prepared = await prepareSidecarImage(image, post.mimeType);
  if (prepared.resized) {
    aiLog.info(
      {
        hash: post.hash,
        width: prepared.width,
        height: prepared.height,
      },
      "OCR image downscaled for sidecar"
    );
  }

  const parsed = await scanImage(prepared.image, prepared.mimeType, { signal: options?.signal });
  return normalizeRegions(parsed, { width: prepared.width, height: prepared.height });
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
  targetLang?: string
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
  targetLanguage: string | null
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
      textColorFg: row.textColorFg,
      textColorBg: row.textColorBg,
      cropVersion,
    })),
  };
}

export async function renderPostInpaintedPage(
  post: ScannablePost,
  options?: { signal?: AbortSignal }
): Promise<Buffer | null> {
  try {
    const image = await readFile(buildFilePath(post.hash, post.extension));
    const prepared = await prepareSidecarImage(image, post.mimeType);
    return await renderInpaintedPage(prepared.image, prepared.mimeType, { signal: options?.signal });
  } catch (error) {
    aiLog.warn(
      { hash: post.hash, error: error instanceof Error ? error.message : String(error) },
      "OCR full-page inpaint unavailable; typeset overlay will degrade to notes"
    );
    return null;
  }
}

/** Record a scan failure without touching existing regions. */
export async function markScanFailed(postId: number): Promise<void> {
  await prisma.post.update({ where: { id: postId }, data: { ocrStatus: "FAILED" } });
}

/**
 * Replace a post's full-page inpaint, then persist regions, all serialized per
 * post hash. Shared by the interactive and batch scan paths so both keep the
 * page inpaint and DB rows mutually consistent.
 */
export async function finalizeScan(
  post: ScannablePost,
  regions: NormalizedRegion[],
  translated: (string | null)[],
  targetLanguage: string | null,
  inpaintedPage: Buffer | null
): Promise<ScanPostOutcome> {
  return withPostCropWriteLock(post.hash, async () => {
    if (inpaintedPage) {
      await storeInpaintedPage(post.hash, inpaintedPage);
    } else {
      await deleteInpaintedPage(post.hash);
    }
    return persistScan(post, regions, translated, targetLanguage);
  });
}

/**
 * Full per-post pipeline: OCR -> translate -> persist.
 * Sidecar/file errors mark the post FAILED and rethrow for route mapping.
 * A 401 during translation is treated like any translation failure here: OCR
 * regions are persisted with null translations and translationFailed is true.
 */
export async function scanPost(post: ScannablePost, targetLang?: string): Promise<ScanPostOutcome> {
  let regions: NormalizedRegion[];
  try {
    regions = await ocrPost(post);
  } catch (error) {
    // Busy is transient service state and the caller is told to retry (503 +
    // Retry-After); recording it as FAILED would drop the post out of default
    // batch scans, which only select PENDING. Leave its status untouched.
    if (!(error instanceof OcrServiceBusyError)) {
      await markScanFailed(post.id).catch(() => {});
    }
    throw error;
  }

  const inpaintedPage = regions.length > 0 ? await renderPostInpaintedPage(post) : null;
  try {
    const { translated, targetLanguage, failed } = await translateRegions(regions, targetLang);
    const outcome = await finalizeScan(post, regions, translated, targetLanguage, inpaintedPage);
    return { ...outcome, translationFailed: failed && outcome.hasText };
  } catch (error) {
    if (error instanceof OpenRouterApiError && error.statusCode === 401) {
      try {
        const outcome = await finalizeScan(post, regions, regions.map(() => null), null, inpaintedPage);
        return { ...outcome, translationFailed: true };
      } catch (recoveryError) {
        // OCR-only persistence itself failed: don't leave the post PENDING.
        await markScanFailed(post.id).catch(() => {});
        throw recoveryError;
      }
    }
    // Persistence failed for a recoverable-OCR post: mark FAILED so a stuck
    // PENDING row doesn't hide the error from rescans/monitoring.
    await markScanFailed(post.id).catch(() => {});
    throw error;
  }
}
