import { ThumbnailSize, ThumbnailStatus } from "@/generated/prisma/client";

export { ThumbnailSize, ThumbnailStatus };

export const THUMBNAIL_DIMENSIONS: Record<ThumbnailSize, number> = {
  GRID: 300,
  PREVIEW: 600,
  ANIMATED: 300, // Same width as grid thumbnails
};

/**
 * Configuration for animated preview generation.
 */
export const ANIMATED_PREVIEW_CONFIG = {
  /** Total duration of the preview in seconds */
  duration: 5,
  /** Frames per second for the animated preview */
  fps: 12,
  /** WebP quality (0-100) */
  quality: 60,
  /** Number of sample points for smart sampling (for videos > 15s) */
  samplePoints: 3,
  /** Minimum video duration in ms to generate animated preview */
  minVideoDuration: 2000,
  /** Minimum GIF duration in ms to generate animated preview */
  minGifDuration: 3000,
};

export interface ThumbnailResult {
  success: boolean;
  path?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  error?: string;
  fallback?: "hydrus";
}

export interface PostForThumbnail {
  id: number;
  hash: string;
  extension: string;
  mimeType: string;
  thumbnailStatus: ThumbnailStatus;
}
