import { sep } from "path";

/**
 * Build file path from hash using Hydrus folder structure:
 * f[first two chars of hash]/[hash].[ext]
 */
export function buildFilePath(hash: string, extension: string): string {
  const basePath = process.env.HYDRUS_FILES_PATH || "";
  const prefix = hash.substring(0, 2).toLowerCase();
  return basePath ? `${basePath}${sep}f${prefix}${sep}${hash}${extension}` : `f${prefix}${sep}${hash}${extension}`;
}

/**
 * Build thumbnail path from hash using Hydrus folder structure:
 * t[first two chars of hash]/[hash].thumbnail
 */
export function buildThumbnailPath(hash: string): string {
  const basePath = process.env.HYDRUS_FILES_PATH || "";
  const prefix = hash.substring(0, 2).toLowerCase();
  return basePath ? `${basePath}${sep}t${prefix}${sep}${hash}.thumbnail` : `t${prefix}${sep}${hash}.thumbnail`;
}
