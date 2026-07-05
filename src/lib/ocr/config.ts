const DEFAULT_TIMEOUT_MS = 120000;

/**
 * OCR-only pipeline configuration for the manga-image-translator sidecar.
 *
 * - translator "original": every key of the response text dict holds the OCR
 *   text and no translation model is ever loaded.
 * - inpainter "lama_large": produces clean text-removed background crops we now
 *   keep; LaMa loads on scan and unloads after models-ttl.
 * - upscale_ratio MUST stay unset so returned pixel coords are in the space of
 *   the uploaded image.
 */
export const OCR_PIPELINE_CONFIG = {
  translator: { translator: "original" },
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

const DEFAULT_VISION_CONTEXT_SIZE = 1024;

/**
 * Whether OCR translation should attach the page image to the LLM call as
 * visual context. Off by default: sending images requires a vision-capable
 * model and costs image tokens, so it is opt-in. Cheap/free when the translation
 * provider is a locally hosted VLM (point the `local` provider at it).
 */
export function isOcrVisionContextEnabled(): boolean {
  const raw = process.env.OCR_TRANSLATION_VISION_CONTEXT?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/**
 * Longest-edge pixel size of the downscaled page image sent as translation
 * context. Small enough to bound image-token cost while preserving the layout
 * cues (speaker, panel order, tone) the model needs. Clamped to [256, 4096].
 */
export function getOcrVisionContextSize(): number {
  const raw = process.env.OCR_TRANSLATION_VISION_CONTEXT_SIZE;
  if (!raw) return DEFAULT_VISION_CONTEXT_SIZE;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 256 || parsed > 4096) {
    return DEFAULT_VISION_CONTEXT_SIZE;
  }
  return parsed;
}
