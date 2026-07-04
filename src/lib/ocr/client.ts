import { getOcrServiceUrl, getOcrTimeoutMs, isOcrEnabled, OCR_PIPELINE_CONFIG } from "./config";
import { OcrServiceResponseError, OcrServiceUnavailableError } from "./errors";
import { parseSidecarResponse } from "./parse";
import type { ParsedRegion } from "./types";
import { aiLog } from "@/lib/logger";

const HEALTH_TIMEOUT_MS = 3000;

/**
 * Run detection + OCR on one image via the manga-image-translator sidecar.
 *
 * The sidecar has a single serial worker: callers MUST NOT parallelize
 * scanImage calls (requests would only stack in its queue).
 *
 * @throws OcrServiceUnavailableError network failure or timeout
 * @throws OcrServiceResponseError non-2xx or unparseable payload
 */
export async function scanImage(
  image: Buffer,
  mimeType: string,
  options?: { signal?: AbortSignal }
): Promise<ParsedRegion[]> {
  const url = `${getOcrServiceUrl()}/translate/with-form/json`;

  const form = new FormData();
  form.append("image", new Blob([new Uint8Array(image)], { type: mimeType }), "image");
  form.append("config", JSON.stringify(OCR_PIPELINE_CONFIG));

  // Timeout always applies; callers (batch cancel) may abort earlier.
  const timeoutSignal = AbortSignal.timeout(getOcrTimeoutMs());
  const signal = options?.signal
    ? AbortSignal.any([timeoutSignal, options.signal])
    : timeoutSignal;

  let response: Response;
  const startTime = Date.now();
  try {
    response = await fetch(url, {
      method: "POST",
      body: form,
      signal,
    });
  } catch (error) {
    const kind =
      error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")
        ? "timed out"
        : "is unreachable";
    aiLog.warn({ error: String(error), durationMs: Date.now() - startTime }, "OCR sidecar request failed");
    throw new OcrServiceUnavailableError(`OCR service ${kind}`, { cause: error });
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    aiLog.error(
      { status: response.status, body: body.slice(0, 500) },
      "OCR sidecar returned an error"
    );
    throw new OcrServiceResponseError(
      `OCR service error: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new OcrServiceResponseError(`OCR service returned invalid JSON: ${String(error)}`);
  }

  const regions = parseSidecarResponse(payload);
  aiLog.debug(
    { regionCount: regions.length, durationMs: Date.now() - startTime },
    "OCR sidecar scan complete"
  );
  return regions;
}

/** Cheap reachability probe (GET /queue-size). Never throws. */
export async function checkOcrServiceHealth(): Promise<boolean> {
  if (!isOcrEnabled()) return false;
  try {
    const response = await fetch(`${getOcrServiceUrl()}/queue-size`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}
