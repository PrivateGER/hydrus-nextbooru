import sharp from "sharp";
import { PHASH_SUPPORTED_MIMES } from "@/lib/phash/compute";

export const EMBEDDING_SUPPORTED_MIMES = PHASH_SUPPORTED_MIMES;

export interface ProcessedEmbeddingImage {
  dataUrl: string;
  sourceWidth: number | null;
  sourceHeight: number | null;
  processedWidth: number;
  processedHeight: number;
  byteLength: number;
}

export async function preprocessImageForEmbedding(
  filePath: string,
  imageMaxResolution: number
): Promise<ProcessedEmbeddingImage> {
  return preprocessSharpImage(sharp(filePath, {
    limitInputPixels: 268402689,
    sequentialRead: true,
  }), imageMaxResolution);
}

export async function preprocessImageBufferForEmbedding(
  buffer: Buffer,
  imageMaxResolution: number
): Promise<ProcessedEmbeddingImage> {
  return preprocessSharpImage(sharp(buffer, {
    limitInputPixels: 268402689,
    sequentialRead: true,
  }), imageMaxResolution);
}

async function preprocessSharpImage(
  image: sharp.Sharp,
  imageMaxResolution: number
): Promise<ProcessedEmbeddingImage> {
  if (!Number.isInteger(imageMaxResolution) || imageMaxResolution < 1) {
    throw new RangeError("imageMaxResolution must be a positive integer");
  }

  const metadata = await image.metadata();
  const { data, info } = await image
    .rotate()
    .resize({
      width: imageMaxResolution,
      height: imageMaxResolution,
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: "#ffffff" })
    .webp({ quality: 90 })
    .toBuffer({ resolveWithObject: true });

  return {
    dataUrl: `data:image/webp;base64,${data.toString("base64")}`,
    sourceWidth: metadata.width ?? null,
    sourceHeight: metadata.height ?? null,
    processedWidth: info.width,
    processedHeight: info.height,
    byteLength: data.byteLength,
  };
}
