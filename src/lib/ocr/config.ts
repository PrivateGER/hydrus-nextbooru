const DEFAULT_TIMEOUT_MS = 120000;

/**
 * OCR-only pipeline configuration for the manga-image-translator sidecar.
 *
 * - translator "original": every key of the response text dict holds the OCR
 *   text and no translation model is ever loaded.
 * - inpainter "none": the OCR/JSON call no longer needs region background
 *   crops; the full-page render performs the single LaMa inpaint used by typeset.
 * - upscale_ratio MUST stay unset so returned pixel coords are in the space of
 *   the uploaded image.
 */
export const OCR_PIPELINE_CONFIG = {
  translator: { translator: "original" },
  inpainter: { inpainter: "none" },
  colorizer: { colorizer: "none" },
  detector: { detector: "default" },
  ocr: { ocr: "48px" },
} as const;

/** Full-page inpaint render: explicit config keeps LaMa enabled for the page image. */
export const OCR_PAGE_INPAINT_CONFIG = {
  translator: { translator: "none" },
  inpainter: { inpainter: "lama_large" },
  colorizer: { colorizer: "none" },
  detector: { detector: "default" },
  ocr: { ocr: "48px" },
} as const;

/** Whether the OCR sidecar feature is configured. */
export function isOcrEnabled(): boolean {
  return Boolean(process.env.OCR_SERVICE_URL?.trim());
}

/** Base URL of the sidecar, without trailing slash. Throws when unset. */
export function getOcrServiceUrl(): string {
  const raw = process.env.OCR_SERVICE_URL?.trim();
  if (!raw) {
    throw new Error("OCR_SERVICE_URL is not configured");
  }
  return raw.replace(/\/+$/, "");
}

/** Per-request sidecar timeout in milliseconds. */
export function getOcrTimeoutMs(): number {
  const raw = process.env.OCR_SERVICE_TIMEOUT_MS;
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;
  return parsed;
}
