import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { renderInpaintedPage, scanImage, checkOcrServiceHealth } from "./client";
import { OcrServiceBusyError, OcrServiceResponseError, OcrServiceUnavailableError } from "./errors";

const okResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  statusText: "OK",
  json: vi.fn().mockResolvedValue(body),
  text: vi.fn().mockResolvedValue(JSON.stringify(body)),
});

const streamFrame = (status: number, payload: string) => {
  const data = Buffer.from(payload);
  const header = Buffer.alloc(5);
  header[0] = status;
  header.writeUInt32BE(data.length, 1);
  return Buffer.concat([header, data]);
};

const binaryStreamFrame = (status: number, payload: Buffer) => {
  const header = Buffer.alloc(5);
  header[0] = status;
  header.writeUInt32BE(payload.length, 1);
  return Buffer.concat([header, payload]);
};

const binaryStreamResponse = (payload: Buffer) => {
  const buffer = binaryStreamFrame(0, payload);
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    arrayBuffer: vi.fn().mockResolvedValue(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    ),
    text: vi.fn().mockResolvedValue(buffer.toString("binary")),
  };
};

const streamResponse = (body: unknown) => {
  const buffer = streamFrame(0, typeof body === "string" ? body : JSON.stringify(body));
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    arrayBuffer: vi.fn().mockResolvedValue(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    ),
    text: vi.fn().mockResolvedValue(buffer.toString("binary")),
  };
};

const multiFrameResponse = (...buffers: Buffer[]) => {
  const buffer = Buffer.concat(buffers);
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    arrayBuffer: vi.fn().mockResolvedValue(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    ),
    text: vi.fn().mockResolvedValue(buffer.toString("binary")),
  };
};

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

  it("POSTs multipart form with image and config to /translate/with-form/json/stream", async () => {
    fetchMock.mockResolvedValueOnce(streamResponse({ translations: [] }));

    const result = await scanImage(Buffer.from([1, 2, 3]), "image/png");
    expect(result).toEqual([]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://ocr:8000/translate/with-form/json/stream");
    expect(init.method).toBe("POST");
    const form = init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    const config = JSON.parse(String(form.get("config")));
    expect(config.translator.translator).toBe("original");
    expect(form.get("image")).toBeInstanceOf(Blob);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("renders a full-page inpaint through the image stream with translation disabled", async () => {
    const image = Buffer.from([9, 8, 7]);
    fetchMock.mockResolvedValueOnce(binaryStreamResponse(image));

    const result = await renderInpaintedPage(Buffer.from([1, 2, 3]), "image/png");

    expect(result).toEqual(image);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://ocr:8000/translate/with-form/image/stream");
    expect(init.method).toBe("POST");
    const form = init.body as FormData;
    const config = JSON.parse(String(form.get("config")));
    expect(config.translator.translator).toBe("none");
    expect(config.inpainter.inpainter).toBe("lama_large");
    expect(form.get("image")).toBeInstanceOf(Blob);
  });

  it("returns parsed regions on success", async () => {
    fetchMock.mockResolvedValueOnce(
      streamResponse({
        translations: [
          { minX: 0, minY: 0, maxX: 10, maxY: 10, prob: 1, angle: 0, text: { ja: "\u3042" } },
        ],
      })
    );
    const result = await scanImage(Buffer.from([1]), "image/jpeg");
    expect(result).toHaveLength(1);
    expect(result[0].ocrText).toBe("\u3042");
  });

  it("returns no regions when the sidecar reports skip-no-regions then errors serializing an empty result", async () => {
    fetchMock.mockResolvedValueOnce(
      multiFrameResponse(
        streamFrame(1, "skip-no-regions"),
        streamFrame(2, "Translation failed: 'NoneType' object is not iterable")
      )
    );

    await expect(scanImage(Buffer.from([1]), "image/png")).resolves.toEqual([]);
  });

  it("returns no regions when the sidecar reports skip-no-text then errors serializing an empty result", async () => {
    fetchMock.mockResolvedValueOnce(
      multiFrameResponse(
        streamFrame(1, "skip-no-text"),
        streamFrame(2, "Translation failed: 'NoneType' object is not iterable")
      )
    );

    await expect(scanImage(Buffer.from([1]), "image/png")).resolves.toEqual([]);
  });

  it("returns no regions when the scan stream ends after a no-text progress frame", async () => {
    fetchMock.mockResolvedValueOnce(multiFrameResponse(streamFrame(1, "skip-no-regions")));

    await expect(scanImage(Buffer.from([1]), "image/png")).resolves.toEqual([]);
  });

  it("rejects parsed null scan results instead of treating them as no-text", async () => {
    fetchMock.mockResolvedValueOnce(streamResponse(null));

    await expect(scanImage(Buffer.from([1]), "image/png")).rejects.toBeInstanceOf(
      OcrServiceResponseError
    );
  });

  it("still rejects scan stream errors that are not preceded by a no-text progress frame", async () => {
    fetchMock.mockResolvedValueOnce(
      multiFrameResponse(streamFrame(1, "detection"), streamFrame(2, "some real failure"))
    );

    await expect(scanImage(Buffer.from([1]), "image/png")).rejects.toBeInstanceOf(
      OcrServiceResponseError
    );
  });

  it("skips non-terminal progress frames before parsing a scan result", async () => {
    fetchMock.mockResolvedValueOnce(
      multiFrameResponse(
        streamFrame(1, "running_pre_translation_hooks"),
        streamFrame(1, "detection"),
        streamFrame(
          0,
          JSON.stringify({
            translations: [
              {
                minX: 0,
                minY: 0,
                maxX: 10,
                maxY: 10,
                prob: 1,
                angle: 0,
                text: { ja: "\u3042" },
              },
            ],
          })
        )
      )
    );

    const result = await scanImage(Buffer.from([1]), "image/jpeg");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      minX: 0,
      minY: 0,
      maxX: 10,
      maxY: 10,
      confidence: 1,
      angle: 0,
      ocrText: "\u3042",
    });
  });

  it("keeps no-text progress handling out of the image stream path", async () => {
    fetchMock.mockResolvedValueOnce(
      multiFrameResponse(
        binaryStreamFrame(1, Buffer.from("skip-no-regions")),
        binaryStreamFrame(2, Buffer.from("Translation failed: 'NoneType' object is not iterable"))
      )
    );

    await expect(renderInpaintedPage(Buffer.from([1]), "image/png")).rejects.toBeInstanceOf(
      OcrServiceResponseError
    );
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

  it("maps body read timeouts to OcrServiceUnavailableError", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: vi.fn().mockRejectedValue(
        new DOMException("The operation timed out.", "TimeoutError")
      ),
      text: vi.fn(),
    });

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

  it("maps HTTP 429 to OcrServiceBusyError on both sidecar endpoints", async () => {
    const busyHttpResponse = () => ({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      json: vi.fn(),
      text: vi.fn().mockResolvedValue("some Method is already being executed."),
    });

    fetchMock.mockResolvedValueOnce(busyHttpResponse());
    await expect(scanImage(Buffer.from([1]), "image/png")).rejects.toBeInstanceOf(
      OcrServiceBusyError
    );

    fetchMock.mockResolvedValueOnce(busyHttpResponse());
    await expect(renderInpaintedPage(Buffer.from([1]), "image/png")).rejects.toBeInstanceOf(
      OcrServiceBusyError
    );
  });

  it("maps worker-busy stream error frames to OcrServiceBusyError", async () => {
    // The gateway relays its worker's 429 rejection inside a stream ERROR
    // frame while the HTTP response itself stays 200.
    const busyText = "Translation failed: 429, some Method is already being executed.";

    fetchMock.mockResolvedValueOnce(multiFrameResponse(streamFrame(2, busyText)));
    await expect(scanImage(Buffer.from([1]), "image/png")).rejects.toBeInstanceOf(
      OcrServiceBusyError
    );

    fetchMock.mockResolvedValueOnce(
      multiFrameResponse(binaryStreamFrame(2, Buffer.from(busyText)))
    );
    await expect(renderInpaintedPage(Buffer.from([1]), "image/png")).rejects.toBeInstanceOf(
      OcrServiceBusyError
    );
  });

  it("keeps non-busy stream errors as plain OcrServiceResponseError", async () => {
    // Terminal per-post errors whose text happens to contain 429-ish tokens
    // must NOT be classified busy: busy triggers the batch's stop-everything
    // policy, so a false positive here wedges every subsequent batch run on
    // the same poison post.
    const terminalTexts = [
      "Translation failed: model exploded",
      'File "detection.py", line 429, in forward',
      "CUDA out of memory. Tried to allocate 429.00 MiB",
      "429 Client Error: Too Many Requests for url: https://huggingface.co/models",
    ];

    for (const text of terminalTexts) {
      fetchMock.mockResolvedValueOnce(multiFrameResponse(streamFrame(2, text)));
      const error = await scanImage(Buffer.from([1]), "image/png").catch((e) => e);
      expect(error, text).toBeInstanceOf(OcrServiceResponseError);
      expect(error, text).not.toBeInstanceOf(OcrServiceBusyError);
    }
  });

  it("maps invalid JSON body to OcrServiceResponseError", async () => {
    fetchMock.mockResolvedValueOnce(streamResponse("<html>"));
    await expect(scanImage(Buffer.from([1]), "image/png")).rejects.toBeInstanceOf(
      OcrServiceResponseError
    );
  });

  it("health check POSTs queue-size and returns false on failure without throwing", async () => {
    fetchMock.mockResolvedValueOnce(okResponse(0));
    await expect(checkOcrServiceHealth()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "http://ocr:8000/queue-size",
      expect.objectContaining({ method: "POST", signal: expect.any(AbortSignal) })
    );

    fetchMock.mockRejectedValueOnce(new TypeError("down"));
    await expect(checkOcrServiceHealth()).resolves.toBe(false);
  });

  it("health check returns false when feature is disabled", async () => {
    delete process.env.OCR_SERVICE_URL;
    await expect(checkOcrServiceHealth()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
