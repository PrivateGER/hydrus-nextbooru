/** Sidecar unreachable: connection refused, DNS failure, or timeout. Maps to 503. */
export class OcrServiceUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "OcrServiceUnavailableError";
  }
}

/** Sidecar answered but unusably: non-2xx status or unparseable payload. Maps to 502. */
export class OcrServiceResponseError extends Error {
  public statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "OcrServiceResponseError";
    this.statusCode = statusCode;
  }
}

/**
 * The sidecar's single worker rejected the request because it is already
 * executing another one (HTTP 429 / "some Method is already being executed").
 * The image is fine — the service is momentarily (or persistently, when its
 * worker lock wedges) occupied, so callers should back off and retry rather
 * than fail the post. Maps to 503 with Retry-After.
 */
export class OcrServiceBusyError extends OcrServiceResponseError {
  constructor(message: string) {
    super(message, 429);
    this.name = "OcrServiceBusyError";
  }
}
