import { join } from "path";

/**
 * Build file path from hash using Hydrus folder structure:
 * f[first two chars of hash]/[hash].[ext]
 */
export function buildFilePath(hash: string, extension: string): string {
  const basePath = process.env.HYDRUS_FILES_PATH || "";
  const prefix = hash.substring(0, 2).toLowerCase();
  return join(basePath, `f${prefix}`, `${hash}${extension}`);
}

/**
 * Build thumbnail path from hash using Hydrus folder structure:
 * t[first two chars of hash]/[hash].thumbnail
 */
export function buildThumbnailPath(hash: string): string {
  const basePath = process.env.HYDRUS_FILES_PATH || "";
  const prefix = hash.substring(0, 2).toLowerCase();
  return join(basePath, `t${prefix}`, `${hash}.thumbnail`);
}
