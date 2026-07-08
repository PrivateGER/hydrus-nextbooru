/**
 * Image MIME types that Sharp can process for pHash computation.
 * SVG is excluded — rasterization is resolution-dependent, producing inconsistent hashes.
 *
 * Lives in its own sharp-free module so consumers that only need the MIME set
 * (e.g. the feed's embedding-eligibility check) don't pull the native sharp
 * dependency into their module graph.
 */
export const PHASH_SUPPORTED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/tiff",
]);
