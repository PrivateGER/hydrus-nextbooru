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
  /**
   * Transient service state (worker busy): back off and retry instead of
   * treating the error as terminal for the post. Response mapping must branch
   * on this flag, not on instanceof-check ordering — a catch site that tests
   * the base class first would otherwise silently turn retryable-busy into a
   * terminal error.
   */
  public readonly retryable: boolean = false;

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
  public override readonly retryable: boolean = true;

  constructor(message: string) {
    super(message, 429);
    this.name = "OcrServiceBusyError";
  }
}
