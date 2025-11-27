import { sep } from "path";
import { ThumbnailSize } from "./types";
import { buildThumbnailPath as buildHydrusThumbnailPath } from "@/lib/hydrus/paths";

/**
 * Get the base path for thumbnail storage.
 * Defaults to ./data/thumbnails relative to project root.
 */
export function getThumbnailBasePath(): string {
  return process.env.THUMBNAIL_PATH || `${process.cwd()}${sep}data${sep}thumbnails`;
}

/**
 * Get the full path for a generated thumbnail.
 * Structure: {base}/{size}/{prefix}/{hash}.webp
 */
export function getThumbnailPath(hash: string, size: ThumbnailSize): string {
  const basePath = getThumbnailBasePath();
  const prefix = hash.substring(0, 2).toLowerCase();
  const sizeDir = size === "GRID" ? "grid" : "preview";
  return `${basePath}${sep}${sizeDir}${sep}${prefix}${sep}${hash}.webp`;
}

/**
 * Get the relative path for storage in database.
 * Structure: {size}/{prefix}/{hash}.webp
 */
export function getThumbnailRelativePath(hash: string, size: ThumbnailSize): string {
  const prefix = hash.substring(0, 2).toLowerCase();
  const sizeDir = size === "GRID" ? "grid" : "preview";
  return `${sizeDir}${sep}${prefix}${sep}${hash}.webp`;
}

/**
 * Get the Hydrus thumbnail path for fallback.
 */
export function getHydrusThumbnailPath(hash: string): string {
  return buildHydrusThumbnailPath(hash);
}
