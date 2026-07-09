import sharp from 'sharp';

const DEFAULT_MAX_IMAGE_SIDE = 2048;
const MIN_MAX_IMAGE_SIDE = 512;

export interface PreparedSidecarImage {
  image: Buffer;
  mimeType: string;
  width: number;
  height: number;
  resized: boolean;
}

function getOcrMaxImageSide(): number {
  const raw = process.env.OCR_MAX_IMAGE_SIDE;
  if (!raw) return DEFAULT_MAX_IMAGE_SIDE;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < MIN_MAX_IMAGE_SIDE) return DEFAULT_MAX_IMAGE_SIDE;
  return parsed;
}

/**
 * Bound images before sending them to manga-image-translator. The sidecar does
 * detection at a limited resolution, but full-resolution inpaint/render can hang
 * on very large pages. Region coordinates are normalized later, so a uniform
 * downscale preserves overlay alignment.
 */
export async function prepareSidecarImage(image: Buffer, mimeType: string): Promise<PreparedSidecarImage> {
  const metadata = await sharp(image).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Cannot read image dimensions');
  }

  const maxSide = getOcrMaxImageSide();
  if (Math.max(metadata.width, metadata.height) <= maxSide) {
    return {
      image,
      mimeType,
      width: metadata.width,
      height: metadata.height,
      resized: false,
    };
  }

  const resized = await sharp(image)
    .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 92 })
    .toBuffer();
  const resizedMetadata = await sharp(resized).metadata();
  if (!resizedMetadata.width || !resizedMetadata.height) {
    throw new Error('Cannot read resized image dimensions');
  }

  return {
    image: resized,
    mimeType: 'image/jpeg',
    width: resizedMetadata.width,
    height: resizedMetadata.height,
    resized: true,
  };
}
