import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isOcrEnabled, getOcrServiceUrl, getOcrTimeoutMs, OCR_PIPELINE_CONFIG } from "./config";

const ORIGINAL_ENV = { ...process.env };

describe("ocr config", () => {
  beforeEach(() => {
    delete process.env.OCR_SERVICE_URL;
    delete process.env.OCR_SERVICE_TIMEOUT_MS;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("is disabled when OCR_SERVICE_URL is unset or blank", () => {
    expect(isOcrEnabled()).toBe(false);
    process.env.OCR_SERVICE_URL = "   ";
    expect(isOcrEnabled()).toBe(false);
  });

  it("is enabled and returns a trimmed URL without trailing slash", () => {
    process.env.OCR_SERVICE_URL = " http://ocr:8000/ ";
    expect(isOcrEnabled()).toBe(true);
    expect(getOcrServiceUrl()).toBe("http://ocr:8000");
  });

  it("getOcrServiceUrl throws when disabled", () => {
    expect(() => getOcrServiceUrl()).toThrow();
  });

  it("timeout defaults to 120000 and rejects garbage/non-positive values", () => {
    expect(getOcrTimeoutMs()).toBe(120000);
    process.env.OCR_SERVICE_TIMEOUT_MS = "abc";
    expect(getOcrTimeoutMs()).toBe(120000);
    process.env.OCR_SERVICE_TIMEOUT_MS = "-5";
    expect(getOcrTimeoutMs()).toBe(120000);
    process.env.OCR_SERVICE_TIMEOUT_MS = "30000";
    expect(getOcrTimeoutMs()).toBe(30000);
  });

  it("pipeline config disables translation, inpainting and colorizing", () => {
    expect(OCR_PIPELINE_CONFIG.translator.translator).toBe("original");
    expect(OCR_PIPELINE_CONFIG.inpainter.inpainter).toBe("lama_large");
    expect(OCR_PIPELINE_CONFIG.colorizer.colorizer).toBe("none");
  });
});
