import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isOcrEnabled,
  getOcrServiceUrl,
  getOcrTimeoutMs,
  getOcrBusyRetryDelaysMs,
  OCR_PIPELINE_CONFIG,
  OCR_PAGE_INPAINT_CONFIG,
} from "./config";

const ORIGINAL_ENV = { ...process.env };

describe("ocr config", () => {
  beforeEach(() => {
    delete process.env.OCR_SERVICE_URL;
    delete process.env.OCR_SERVICE_TIMEOUT_MS;
    delete process.env.OCR_BUSY_RETRY_DELAYS_MS;
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

  it("busy retry delays default to a growing schedule and accept a comma list", () => {
    // Default timeout 120s: two serial sidecar calls of legitimate occupancy
    // (240s) + margin must fit inside the schedule, so the 155s base schedule
    // is extended with repeats of its last step.
    expect(getOcrBusyRetryDelaysMs()).toEqual([5_000, 15_000, 45_000, 90_000, 90_000, 90_000]);

    process.env.OCR_BUSY_RETRY_DELAYS_MS = "0, 10,250";
    expect(getOcrBusyRetryDelaysMs()).toEqual([0, 10, 250]);

    process.env.OCR_BUSY_RETRY_DELAYS_MS = "garbage,-3";
    expect(getOcrBusyRetryDelaysMs()).toEqual([5_000, 15_000, 45_000, 90_000, 90_000, 90_000]);
  });

  it("default busy schedule always outlasts two request timeouts", () => {
    const sum = (delays: number[]) => delays.reduce((total, delay) => total + delay, 0);

    // Small timeout: the base schedule already covers occupancy; no extension.
    process.env.OCR_SERVICE_TIMEOUT_MS = "10000";
    expect(getOcrBusyRetryDelaysMs()).toEqual([5_000, 15_000, 45_000, 90_000]);

    // Large timeout: the schedule grows until it outlasts 2x timeout + margin,
    // so a single long-running competing client can never exhaust it.
    process.env.OCR_SERVICE_TIMEOUT_MS = "300000";
    const delays = getOcrBusyRetryDelaysMs();
    expect(sum(delays)).toBeGreaterThanOrEqual(2 * 300000 + 30000);
    expect(delays.slice(0, 4)).toEqual([5_000, 15_000, 45_000, 90_000]);

    // An explicit override is absolute: the operator's schedule is not padded.
    process.env.OCR_BUSY_RETRY_DELAYS_MS = "1000";
    expect(getOcrBusyRetryDelaysMs()).toEqual([1000]);
  });

  it("uses separate sidecar configs for OCR JSON and page inpaint calls", () => {
    expect(OCR_PIPELINE_CONFIG.translator.translator).toBe("original");
    expect(OCR_PIPELINE_CONFIG.inpainter.inpainter).toBe("none");
    expect(OCR_PIPELINE_CONFIG.colorizer.colorizer).toBe("none");

    expect(OCR_PAGE_INPAINT_CONFIG.translator.translator).toBe("none");
    expect(OCR_PAGE_INPAINT_CONFIG.inpainter.inpainter).toBe("lama_large");
    expect(OCR_PAGE_INPAINT_CONFIG.colorizer.colorizer).toBe("none");
  });
});
