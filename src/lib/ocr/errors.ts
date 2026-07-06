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
