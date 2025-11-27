import { ThumbnailSize, ThumbnailStatus } from "@/generated/prisma/client";

export { ThumbnailSize, ThumbnailStatus };

export const THUMBNAIL_DIMENSIONS: Record<ThumbnailSize, number> = {
  GRID: 300,
  PREVIEW: 600,
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
