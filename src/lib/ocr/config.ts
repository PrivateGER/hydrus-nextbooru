import { aiLog } from "@/lib/logger";

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

const BASE_BUSY_RETRY_DELAYS_MS = [5_000, 15_000, 45_000, 90_000];
const BUSY_OCCUPANCY_MARGIN_MS = 30_000;

/**
 * Default busy backoff: the base schedule, extended by repeating its last
 * step until the cumulative wait outlasts the longest LEGITIMATE worker
 * occupancy — one competing client's two serial sidecar calls (scan + page
 * inpaint), each capped at the request timeout, plus margin. A schedule
 * shorter than that misdiagnoses a healthy sidecar serving a single
 * concurrent request as wedged and stops the whole batch with a false
 * "restart the container" error.
 */
function defaultBusyRetryDelaysMs(): number[] {
  const target = 2 * getOcrTimeoutMs() + BUSY_OCCUPANCY_MARGIN_MS;
  const delays = [...BASE_BUSY_RETRY_DELAYS_MS];
  const step = delays[delays.length - 1];
  let total = delays.reduce((sum, delay) => sum + delay, 0);
  while (total < target) {
    delays.push(step);
    total += step;
  }
  return delays;
}

/**
 * Backoff schedule for retrying a sidecar call that was rejected as busy
 * (429). The sidecar's single worker keeps grinding a job even after its
 * client times out and disconnects, and during that window its gateway can
 * dispatch new work straight into the worker's busy lock — so busy responses
 * are transient service state, never a property of the post being scanned.
 * Override with OCR_BUSY_RETRY_DELAYS_MS as a comma-separated ms list; an
 * explicit override is used as-is (not extended to cover occupancy).
 */
let warnedInvalidBusyDelays: string | undefined;

export function getOcrBusyRetryDelaysMs(): number[] {
  const raw = process.env.OCR_BUSY_RETRY_DELAYS_MS;
  if (!raw?.trim()) return defaultBusyRetryDelaysMs();
  // Every entry must be a plain non-negative integer, and ANY bad entry
  // rejects the whole override. Salvaging the valid entries would let a typo
  // silently corrupt the schedule: parseInt turns "5000;15000;45000" into
  // [5000] (one 5s retry) and "15s" into a 15 MILLISECOND delay, and an
  // early-exhausted schedule surfaces as the wedged-sidecar batch stop.
  const parts = raw.split(",").map((part) => part.trim());
  if (parts.every((part) => /^\d+$/.test(part))) {
    return parts.map((part) => Number.parseInt(part, 10));
  }
  if (warnedInvalidBusyDelays !== raw) {
    warnedInvalidBusyDelays = raw;
    aiLog.warn(
      { raw },
      "Invalid OCR_BUSY_RETRY_DELAYS_MS (expected comma-separated non-negative integers); using the default busy retry schedule"
    );
  }
  return defaultBusyRetryDelaysMs();
}

/** Per-request sidecar timeout in milliseconds. */
export function getOcrTimeoutMs(): number {
  const raw = process.env.OCR_SERVICE_TIMEOUT_MS;
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;
  return parsed;
}
