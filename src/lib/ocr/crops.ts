import { mkdir, rm } from "fs/promises";
import { join } from "path";
import sharp from "sharp";
import { aiLog } from "@/lib/logger";
import { getThumbnailBasePath } from "@/lib/thumbnails/paths";
import type { NormalizedRegion } from "./types";

const WEBP_QUALITY = 85;

/**
 * Root for OCR crops, nested under the shared thumbnail volume so there is a
 * single source of truth for the storage root (see thumbnails/paths.ts).
 */
function cropBasePath(): string {
  return join(getThumbnailBasePath(), "ocr-crops");
}

function pageBasePath(): string {
  return join(getThumbnailBasePath(), "ocr-pages");
}

/** Directory holding one post's region crops. */
export function buildCropDir(hash: string): string {
  return join(cropBasePath(), hash.toLowerCase());
}

/** File path for one region's crop. */
export function buildCropFilePath(hash: string, readingOrder: number): string {
  return join(buildCropDir(hash), `${readingOrder}.webp`);
}

/** File path for a post's full-page inpaint render. */
export function buildInpaintedPageFilePath(hash: string): string {
  return join(pageBasePath(), `${hash.toLowerCase()}.webp`);
}

/**
 * Replace a post's stored crops. Returns hasCrop flags aligned with regions.
 * Never throws: any failure degrades the affected region(s) to false.
 */
export async function storeCrops(hash: string, regions: NormalizedRegion[]): Promise<boolean[]> {
  const dir = buildCropDir(hash);
  try {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
  } catch (error) {
    aiLog.warn({ hash, error: String(error) }, "OCR crop directory preparation failed");
    return regions.map(() => false);
  }

  const flags: boolean[] = [];
  for (const region of regions) {
    if (!region.cropBase64) {
      flags.push(false);
      continue;
    }
    try {
      const buffer = Buffer.from(region.cropBase64, "base64");
      await sharp(buffer).webp({ quality: WEBP_QUALITY }).toFile(buildCropFilePath(hash, region.readingOrder));
      flags.push(true);
    } catch (error) {
      aiLog.warn(
        { hash, readingOrder: region.readingOrder, error: String(error) },
        "OCR crop write failed; region degrades to notes mode"
      );
      flags.push(false);
    }
  }
  return flags;
}

/** Replace a post's full-page inpaint image. Never throws. */
export async function storeInpaintedPage(hash: string, image: Buffer): Promise<boolean> {
  const filePath = buildInpaintedPageFilePath(hash);
  try {
    await mkdir(pageBasePath(), { recursive: true });
    await sharp(image).webp({ quality: WEBP_QUALITY }).toFile(filePath);
    return true;
  } catch (error) {
    await rm(filePath, { force: true }).catch(() => {});
    aiLog.warn({ hash, error: String(error) }, "OCR full-page inpaint write failed");
    return false;
  }
}

/** Remove a post's full-page inpaint image. Best-effort. */
export async function deleteInpaintedPage(hash: string): Promise<void> {
  await rm(buildInpaintedPageFilePath(hash), { force: true }).catch(() => {});
}

/** Remove a post's crop directory. Best-effort. */
export async function deleteCrops(hash: string): Promise<void> {
  await Promise.all([
    rm(buildCropDir(hash), { recursive: true, force: true }).catch(() => {}),
    deleteInpaintedPage(hash),
  ]);
}
