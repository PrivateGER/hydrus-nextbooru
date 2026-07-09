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

/** Full-page inpaint render: shares the pipeline config but re-enables LaMa and disables text rendering. */
export const OCR_PAGE_INPAINT_CONFIG = {
  ...OCR_PIPELINE_CONFIG,
  translator: { translator: "none" },
  inpainter: { inpainter: "lama_large" },
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

const DEFAULT_BUSY_RETRY_DELAYS_MS = [5_000, 15_000, 45_000, 90_000];

/**
 * Backoff schedule for retrying a sidecar call that was rejected as busy
 * (429). The sidecar's single worker keeps grinding a job even after its
 * client times out and disconnects, and during that window its gateway can
 * dispatch new work straight into the worker's busy lock — so busy responses
 * are transient service state, never a property of the post being scanned.
 * Override with OCR_BUSY_RETRY_DELAYS_MS as a comma-separated ms list.
 */
export function getOcrBusyRetryDelaysMs(): number[] {
  const raw = process.env.OCR_BUSY_RETRY_DELAYS_MS;
  if (!raw?.trim()) return DEFAULT_BUSY_RETRY_DELAYS_MS;
  const parsed = raw
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((value) => Number.isFinite(value) && value >= 0);
  return parsed.length > 0 ? parsed : DEFAULT_BUSY_RETRY_DELAYS_MS;
}

/** Per-request sidecar timeout in milliseconds. */
export function getOcrTimeoutMs(): number {
  const raw = process.env.OCR_SERVICE_TIMEOUT_MS;
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;
  return parsed;
}
