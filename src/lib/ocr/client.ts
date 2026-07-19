import { getOcrServiceUrl, getOcrTimeoutMs, isOcrEnabled, OCR_PAGE_INPAINT_CONFIG, OCR_PIPELINE_CONFIG } from "./config";
import { OcrServiceBusyError, OcrServiceResponseError, OcrServiceUnavailableError } from "./errors";
import { parseSidecarResponse } from "./parse";
import type { ParsedRegion } from "./types";
import { aiLog } from "@/lib/logger";

const HEALTH_TIMEOUT_MS = 3000;
const STREAM_RESULT = 0;
const STREAM_PROGRESS = 1;
const STREAM_ERROR = 2;
const STREAM_HEADER_BYTES = 5;

// manga-image-translator emits one of these progress states when detection or
// OCR finds no text. On the JSON scan endpoint the sidecar then crashes while
// serializing the empty result ("'NoneType' object is not iterable") and
// surfaces it as a stream ERROR frame — so a genuinely text-free page arrives
// as an error. The skip state is authoritative: the page simply has no text,
// which is a COMPLETE scan with zero regions, not a failure.
const NO_TEXT_PROGRESS_STATES = new Set(["skip-no-regions", "skip-no-text"]);

// The sidecar's gateway keeps its task queue unbounded, but the single worker
// behind it guards itself with a non-blocking lock and rejects overlapping
// work with HTTP 429 ("some Method is already being executed"). On the
// streaming endpoints that rejection is relayed to us inside a stream ERROR
// frame (the HTTP response itself stays 200), so busy-ness must be detected
// from the frame text. Match ONLY the worker-lock message: stream ERROR frames
// carry arbitrary exception text (tracebacks, byte counts, relayed upstream
// errors) in which a bare "429" or "too many requests" can appear for reasons
// that are terminal for the post, and busy classification triggers the batch's
// stop-everything policy — a false positive here wedges all batch scanning.
// Literal HTTP 429 statuses are classified exactly in responseStatusError.
const BUSY_STREAM_ERROR_PATTERN = /already being executed/i;

function classifyStreamError(text: string): OcrServiceResponseError {
  if (BUSY_STREAM_ERROR_PATTERN.test(text)) {
    return new OcrServiceBusyError(`OCR service is busy: ${text}`);
  }
  return new OcrServiceResponseError(`OCR service stream error: ${text}`);
}

function responseStatusError(response: Response): OcrServiceResponseError {
  if (response.status === 429) {
    return new OcrServiceBusyError(
      `OCR service is busy: ${response.status} ${response.statusText}`
    );
  }
  return new OcrServiceResponseError(
    `OCR service error: ${response.status} ${response.statusText}`,
    response.status
  );
}


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
    aiLog.error(
      { status: response.status, body: body.slice(0, 500) },
      "OCR sidecar returned an error"
    );
    throw responseStatusError(response);
  }

  const frame = await readScanResultPayload(response);
  if (frame === null) {
    aiLog.debug(
      { durationMs: Date.now() - startTime },
      "OCR sidecar reported no text regions"
    );
    return [];
  }

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(frame));
  } catch (error) {
    throw new OcrServiceResponseError(`OCR service returned invalid JSON: ${String(error)}`);
  }

  // A parsed JSON `null` body is NOT the no-text case (that is signalled by a
  // null frame above); let parseSidecarResponse reject it as malformed.
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
    throw responseStatusError(response);
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

async function readStreamBytes(response: Response): Promise<Uint8Array> {
  try {
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    if (isAbortLikeError(error)) {
      throw new OcrServiceUnavailableError("OCR service timed out", { cause: error });
    }
    throw new OcrServiceResponseError(`OCR service returned unreadable stream: ${String(error)}`);
  }
}

/** Walk the sidecar's `status(1B) size(4B) data(size)` framing. */
function* iterateStreamFrames(
  bytes: Uint8Array
): Generator<{ status: number; frame: Uint8Array }> {
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
    yield { status, frame };
  }
}

async function readStreamResultPayload(response: Response): Promise<Uint8Array> {
  const bytes = await readStreamBytes(response);
  for (const { status, frame } of iterateStreamFrames(bytes)) {
    if (status === STREAM_ERROR) {
      throw classifyStreamError(new TextDecoder().decode(frame));
    }
    if (status === STREAM_RESULT) return frame;
  }

  throw new OcrServiceResponseError("OCR service stream ended without a result frame");
}

/**
 * Read the JSON scan stream. Returns the result payload, or null when the
 * sidecar signalled a no-text page. Such pages surface as an ERROR frame
 * (the sidecar crashes serializing the empty result), so a preceding
 * NO_TEXT_PROGRESS_STATES frame is what distinguishes them from real failures.
 */
async function readScanResultPayload(response: Response): Promise<Uint8Array | null> {
  const bytes = await readStreamBytes(response);
  let sawNoText = false;
  for (const { status, frame } of iterateStreamFrames(bytes)) {
    if (status === STREAM_PROGRESS) {
      if (NO_TEXT_PROGRESS_STATES.has(new TextDecoder().decode(frame))) sawNoText = true;
      continue;
    }
    if (status === STREAM_ERROR) {
      if (sawNoText) return null;
      throw classifyStreamError(new TextDecoder().decode(frame));
    }
    if (status === STREAM_RESULT) return frame;
  }

  if (sawNoText) return null;
  throw new OcrServiceResponseError("OCR service stream ended without a result frame");
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
