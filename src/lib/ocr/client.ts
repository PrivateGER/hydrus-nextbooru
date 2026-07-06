import { getOcrServiceUrl, getOcrTimeoutMs, isOcrEnabled, OCR_PAGE_INPAINT_CONFIG, OCR_PIPELINE_CONFIG } from "./config";
import { OcrServiceResponseError, OcrServiceUnavailableError } from "./errors";
import { parseSidecarResponse } from "./parse";
import type { ParsedRegion } from "./types";
import { aiLog } from "@/lib/logger";

const HEALTH_TIMEOUT_MS = 3000;
const STREAM_RESULT = 0;
const STREAM_ERROR = 2;
const STREAM_HEADER_BYTES = 5;

/**
 * The sidecar reports an image with no detectable text as an *error*
 * ("No text regions! - Skipping") rather than an empty result. For OCR that is
 * a successful scan that simply found nothing, so we translate this marker into
 * zero regions instead of surfacing it as a service failure (which would mark
 * the post FAILED and count it as a batch error).
 */
const NO_TEXT_REGIONS_MARKER = /no text regions/i;


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
  const url = `${getOcrServiceUrl()}/translate/with-form/json/stream`;

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
    if (NO_TEXT_REGIONS_MARKER.test(body)) {
      aiLog.debug(
        { status: response.status, durationMs: Date.now() - startTime },
        "OCR sidecar reported no text regions; treating as an empty scan"
      );
      return [];
    }
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
    payload = await readStreamJsonPayload(response);
  } catch (error) {
    // The sidecar can also deliver the "no text regions" signal as a stream
    // error frame after a 200 OK; that is still a successful, textless scan.
    if (error instanceof OcrServiceResponseError && NO_TEXT_REGIONS_MARKER.test(error.message)) {
      aiLog.debug(
        { durationMs: Date.now() - startTime },
        "OCR sidecar reported no text regions; treating as an empty scan"
      );
      return [];
    }
    throw error;
  }

  const regions = parseSidecarResponse(payload);
  aiLog.debug(
    { regionCount: regions.length, durationMs: Date.now() - startTime },
    "OCR sidecar scan complete"
  );
  return regions;
}

/**
 * Render the image through the sidecar's inpainting pipeline with translation
 * disabled, returning a full-page image suitable as the typeset overlay base.
 */
export async function renderInpaintedPage(
  image: Buffer,
  mimeType: string,
  options?: { signal?: AbortSignal }
): Promise<Buffer> {
  const url = `${getOcrServiceUrl()}/translate/with-form/image/stream`;

  const form = new FormData();
  form.append("image", new Blob([new Uint8Array(image)], { type: mimeType }), "image");
  form.append("config", JSON.stringify(OCR_PAGE_INPAINT_CONFIG));

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
    const kind = isAbortLikeError(error) ? "timed out" : "is unreachable";
    aiLog.warn({ error: String(error), durationMs: Date.now() - startTime }, "OCR sidecar page inpaint failed");
    throw new OcrServiceUnavailableError(`OCR service ${kind}`, { cause: error });
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    aiLog.error(
      { status: response.status, body: body.slice(0, 500) },
      "OCR sidecar returned a page inpaint error"
    );
    throw new OcrServiceResponseError(
      `OCR service error: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  const payload = await readStreamResultPayload(response);
  aiLog.debug(
    { byteLength: payload.byteLength, durationMs: Date.now() - startTime },
    "OCR sidecar page inpaint complete"
  );
  return Buffer.from(payload);
}

function isAbortLikeError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

async function readStreamResultPayload(response: Response): Promise<Uint8Array> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    if (isAbortLikeError(error)) {
      throw new OcrServiceUnavailableError("OCR service timed out", { cause: error });
    }
    throw new OcrServiceResponseError(`OCR service returned unreadable stream: ${String(error)}`);
  }
  let offset = 0;
  while (offset + STREAM_HEADER_BYTES <= bytes.length) {
    const status = bytes[offset];
    const size =
      (bytes[offset + 1] << 24) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 8) |
      bytes[offset + 4];
    offset += STREAM_HEADER_BYTES;

    if (size < 0 || offset + size > bytes.length) {
      throw new OcrServiceResponseError("OCR service returned a malformed stream frame");
    }

    const frame = bytes.subarray(offset, offset + size);
    offset += size;

    if (status === STREAM_ERROR) {
      const message = new TextDecoder().decode(frame);
      throw new OcrServiceResponseError(`OCR service stream error: ${message}`);
    }

    if (status !== STREAM_RESULT) continue;

    return frame;
  }

  throw new OcrServiceResponseError("OCR service stream ended without a result frame");
}

async function readStreamJsonPayload(response: Response): Promise<unknown> {
  const frame = await readStreamResultPayload(response);
  try {
    return JSON.parse(new TextDecoder().decode(frame));
  } catch (error) {
    throw new OcrServiceResponseError(`OCR service returned invalid JSON: ${String(error)}`);
  }
}

/** Cheap reachability probe (POST /queue-size). Never throws. */
export async function checkOcrServiceHealth(): Promise<boolean> {
  if (!isOcrEnabled()) return false;
  try {
    const response = await fetch(`${getOcrServiceUrl()}/queue-size`, {
      method: "POST",
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}
