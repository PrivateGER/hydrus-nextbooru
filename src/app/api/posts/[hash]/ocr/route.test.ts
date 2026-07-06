import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  mockScanPost,
  mockIsOcrEnabled,
  mockPostFindUnique,
  mockCheckApiRateLimit,
  MockOcrFileMissingError,
  MockOcrServiceUnavailableError,
  MockOcrServiceResponseError,
} = vi.hoisted(() => {
  class TestOcrFileMissingError extends Error {}
  class TestOcrServiceUnavailableError extends Error {}
  class TestOcrServiceResponseError extends Error {
    statusCode?: number;
    constructor(message: string, statusCode?: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return {
    mockScanPost: vi.fn(),
    mockIsOcrEnabled: vi.fn(),
    mockPostFindUnique: vi.fn(),
    mockCheckApiRateLimit: vi.fn(() => null),
    MockOcrFileMissingError: TestOcrFileMissingError,
    MockOcrServiceUnavailableError: TestOcrServiceUnavailableError,
    MockOcrServiceResponseError: TestOcrServiceResponseError,
  };
});

vi.mock("@/lib/ocr", () => ({
  scanPost: mockScanPost,
  isOcrEnabled: mockIsOcrEnabled,
  OcrFileMissingError: MockOcrFileMissingError,
  OcrServiceUnavailableError: MockOcrServiceUnavailableError,
  OcrServiceResponseError: MockOcrServiceResponseError,
}));

vi.mock("@/lib/db", () => ({
  prisma: { post: { findUnique: mockPostFindUnique } },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: mockCheckApiRateLimit,
}));

import { POST } from "./route";
import {
  OcrServiceUnavailableError,
  OcrServiceResponseError,
  OcrFileMissingError,
} from "@/lib/ocr";

const HASH = "a".repeat(64);
const request = () =>
  new NextRequest(`http://localhost/api/posts/${HASH}/ocr`, { method: "POST" });
const params = (hash: string) => ({ params: Promise.resolve({ hash }) });

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckApiRateLimit.mockReturnValue(null);
  mockIsOcrEnabled.mockReturnValue(true);
  mockPostFindUnique.mockResolvedValue({
    id: 1,
    hash: HASH,
    extension: ".png",
    mimeType: "image/png",
  });
});

describe("POST /api/posts/[hash]/ocr", () => {
  it("503 when the feature is disabled", async () => {
    mockIsOcrEnabled.mockReturnValue(false);
    const response = await POST(request(), params(HASH));
    expect(response.status).toBe(503);
  });

  it("400 on malformed hash", async () => {
    const response = await POST(request(), params("nope"));
    expect(response.status).toBe(400);
  });

  it("404 when post is missing", async () => {
    mockPostFindUnique.mockResolvedValue(null);
    const response = await POST(request(), params(HASH));
    expect(response.status).toBe(404);
  });

  it("400 on non-image posts", async () => {
    mockPostFindUnique.mockResolvedValue({
      id: 1,
      hash: HASH,
      extension: ".mp4",
      mimeType: "video/mp4",
    });
    const response = await POST(request(), params(HASH));
    expect(response.status).toBe(400);
  });

  it("200 with scan outcome on success", async () => {
    mockScanPost.mockResolvedValue({
      hasText: true,
      translationFailed: false,
      scannedAt: new Date("2026-07-04T00:00:00Z"),
      regions: [
        {
          readingOrder: 0,
          x: 0.1,
          y: 0.1,
          width: 0.2,
          height: 0.2,
          ocrText: "\u3042",
          translatedText: "Ah",
          sourceLanguage: "ja",
        },
      ],
    });
    const response = await POST(request(), params(HASH));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.hash).toBe(HASH);
    expect(body.hasText).toBe(true);
    expect(body.regions).toHaveLength(1);
  });

  it("maps sidecar unavailability to 503 and bad responses to 502", async () => {
    mockScanPost.mockRejectedValueOnce(new OcrServiceUnavailableError("down"));
    expect((await POST(request(), params(HASH))).status).toBe(503);

    mockScanPost.mockRejectedValueOnce(new OcrServiceResponseError("garbage", 500));
    expect((await POST(request(), params(HASH))).status).toBe(502);
  });

  it("maps missing files to 404", async () => {
    mockScanPost.mockRejectedValueOnce(new OcrFileMissingError("gone"));
    expect((await POST(request(), params(HASH))).status).toBe(404);
  });

  it("does not throw on a literal null JSON body", async () => {
    mockScanPost.mockResolvedValue({
      hasText: false,
      translationFailed: false,
      scannedAt: new Date("2026-07-04T00:00:00Z"),
      regions: [],
    });
    const nullBodyRequest = new NextRequest(`http://localhost/api/posts/${HASH}/ocr`, {
      method: "POST",
      body: "null",
      headers: { "content-type": "application/json" },
    });
    const response = await POST(nullBodyRequest, params(HASH));
    expect(response.status).toBe(200);
  });
});
