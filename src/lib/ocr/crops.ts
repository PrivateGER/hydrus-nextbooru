import { mkdir, rm } from "fs/promises";
import { join } from "path";
import sharp from "sharp";
import { aiLog } from "@/lib/logger";
import { getThumbnailBasePath } from "@/lib/thumbnails/paths";

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

/** File path for a post's full-page inpaint render. */
export function buildInpaintedPageFilePath(hash: string): string {
  return join(pageBasePath(), `${hash.toLowerCase()}.webp`);
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

/** Remove stored OCR renders for a post, including legacy per-region crop dirs. Best-effort. */
export async function deleteCrops(hash: string): Promise<void> {
  await Promise.all([
    deleteInpaintedPage(hash),
    rm(join(cropBasePath(), hash.toLowerCase()), { recursive: true, force: true }).catch(() => {}),
  ]);
}
