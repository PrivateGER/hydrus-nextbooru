import type { NormalizedRegion, ParsedRegion } from "./types";

const clamp = (value: number, max: number): number =>
  Math.min(max, Math.max(0, value));

/**
 * Convert sidecar pixel boxes into resolution-independent 0-1 coordinates.
 *
 * `dims` MUST be the dimensions of the exact image buffer that was uploaded
 * to the sidecar (sharp metadata), not Post.width/height.
 *
 * Coordinates are clamped in pixel space before dividing so that clean pixel
 * ratios (e.g. 200/1000) stay float-exact instead of accumulating subtraction
 * error in normalized space.
 */
export function normalizeRegions(
  regions: ParsedRegion[],
  dims: { width: number; height: number }
): NormalizedRegion[] {
  if (dims.width <= 0 || dims.height <= 0) {
    throw new RangeError(`Invalid image dimensions ${dims.width}x${dims.height}`);
  }

  const result: NormalizedRegion[] = [];

  for (const region of regions) {
    const x0 = clamp(region.minX, dims.width);
    const y0 = clamp(region.minY, dims.height);
    const x1 = clamp(region.maxX, dims.width);
    const y1 = clamp(region.maxY, dims.height);
    const width = (x1 - x0) / dims.width;
    const height = (y1 - y0) / dims.height;
    if (width <= 0 || height <= 0) continue;

    result.push({
      readingOrder: result.length,
      x: x0 / dims.width,
      y: y0 / dims.height,
      width,
      height,
      ocrText: region.ocrText,
      sourceLanguage: region.sourceLanguage,
      confidence: region.confidence,
      angle: region.angle,
      textColorFg: region.textColorFg,
      textColorBg: region.textColorBg,
    });
  }

  return result;
}
