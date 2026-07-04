import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { scanImage, checkOcrServiceHealth } from "./client";
import { OcrServiceResponseError, OcrServiceUnavailableError } from "./errors";

const okResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  statusText: "OK",
  json: vi.fn().mockResolvedValue(body),
  text: vi.fn().mockResolvedValue(JSON.stringify(body)),
});

describe("ocr client", () => {
  const originalFetch = global.fetch;
  let fetchMock: Mock;

  beforeEach(() => {
    process.env.OCR_SERVICE_URL = "http://ocr:8000";
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    delete process.env.OCR_SERVICE_URL;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("POSTs multipart form with image and config to /translate/with-form/json", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ translations: [] }));

    const result = await scanImage(Buffer.from([1, 2, 3]), "image/png");
    expect(result).toEqual([]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://ocr:8000/translate/with-form/json");
    expect(init.method).toBe("POST");
    const form = init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    const config = JSON.parse(String(form.get("config")));
    expect(config.translator.translator).toBe("original");
    expect(form.get("image")).toBeInstanceOf(Blob);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns parsed regions on success", async () => {
    fetchMock.mockResolvedValueOnce(
      okResponse({
        translations: [
          { minX: 0, minY: 0, maxX: 10, maxY: 10, prob: 1, angle: 0, text: { ja: "\u3042" } },
        ],
      })
    );
    const result = await scanImage(Buffer.from([1]), "image/jpeg");
    expect(result).toHaveLength(1);
    expect(result[0].ocrText).toBe("\u3042");
  });

  it("maps network errors to OcrServiceUnavailableError", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(scanImage(Buffer.from([1]), "image/png")).rejects.toBeInstanceOf(
      OcrServiceUnavailableError
    );
  });

  it("maps timeouts to OcrServiceUnavailableError", async () => {
    fetchMock.mockRejectedValueOnce(
      new DOMException("The operation timed out.", "TimeoutError")
    );
    await expect(scanImage(Buffer.from([1]), "image/png")).rejects.toBeInstanceOf(
      OcrServiceUnavailableError
    );
  });

  it("maps non-2xx to OcrServiceResponseError with status", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: vi.fn(),
      text: vi.fn().mockResolvedValue("boom"),
    });
    await expect(scanImage(Buffer.from([1]), "image/png")).rejects.toMatchObject({
      name: "OcrServiceResponseError",
      statusCode: 500,
    });
  });

  it("maps invalid JSON body to OcrServiceResponseError", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn().mockRejectedValue(new SyntaxError("bad json")),
      text: vi.fn().mockResolvedValue("<html>"),
    });
    await expect(scanImage(Buffer.from([1]), "image/png")).rejects.toBeInstanceOf(
      OcrServiceResponseError
    );
  });

  it("health check returns true on 200 and false on failure without throwing", async () => {
    fetchMock.mockResolvedValueOnce(okResponse(0));
    await expect(checkOcrServiceHealth()).resolves.toBe(true);

    fetchMock.mockRejectedValueOnce(new TypeError("down"));
    await expect(checkOcrServiceHealth()).resolves.toBe(false);
  });

  it("health check returns false when feature is disabled", async () => {
    delete process.env.OCR_SERVICE_URL;
    await expect(checkOcrServiceHealth()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
