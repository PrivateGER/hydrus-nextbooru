import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as OpenRouterModule from "@/lib/openrouter";

const {
  mockReadFile,
  mockMetadata,
  mockScanImage,
  mockRenderInpaintedPage,
  mockPrepareSidecarImage,
  mockTranslateTexts,
  mockRegionDeleteMany,
  mockRegionCreateMany,
  mockRegionFindMany,
  mockPostUpdate,
  mockTransaction,
  mockStoreInpaintedPage,
  mockDeleteInpaintedPage,
} = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockMetadata: vi.fn(),
  mockScanImage: vi.fn(),
  mockRenderInpaintedPage: vi.fn(),
  mockPrepareSidecarImage: vi.fn(),
  mockTranslateTexts: vi.fn(),
  mockRegionDeleteMany: vi.fn(),
  mockRegionCreateMany: vi.fn(),
  mockRegionFindMany: vi.fn(),
  mockPostUpdate: vi.fn(),
  mockTransaction: vi.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  mockStoreInpaintedPage: vi.fn(),
  mockDeleteInpaintedPage: vi.fn(),
}));

vi.mock("fs/promises", () => ({ readFile: mockReadFile }));

vi.mock("sharp", () => ({
  default: vi.fn(() => ({ metadata: mockMetadata })),
}));

vi.mock("./client", () => ({
  scanImage: mockScanImage,
  renderInpaintedPage: mockRenderInpaintedPage,
  checkOcrServiceHealth: vi.fn(),
}));

vi.mock("./image-prep", () => ({
  prepareSidecarImage: mockPrepareSidecarImage,
}));

vi.mock("@/lib/openrouter", async (importOriginal) => {
  const actual = await importOriginal<typeof OpenRouterModule>();
  return {
    ...actual,
    getOpenRouterClient: vi.fn(async () => ({ translateTexts: mockTranslateTexts })),
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mockTransaction,
    imageTextRegion: {
      deleteMany: mockRegionDeleteMany,
      createMany: mockRegionCreateMany,
      findMany: mockRegionFindMany,
    },
    post: { update: mockPostUpdate },
  },
}));

vi.mock("./crops", () => ({ storeInpaintedPage: mockStoreInpaintedPage, deleteInpaintedPage: mockDeleteInpaintedPage }));

import { finalizeScan, scanPost, translateRegions, OcrFileMissingError, withPostCropWriteLock } from "./scan-post";
import { OcrServiceBusyError, OcrServiceUnavailableError } from "./errors";
import { OpenRouterApiError } from "@/lib/openrouter";
import type { NormalizedRegion } from "./types";

const POST = { id: 7, hash: "a".repeat(64), extension: ".png", mimeType: "image/png" };

const normalized = (overrides: Partial<NormalizedRegion> = {}): NormalizedRegion => ({
  readingOrder: 0,
  x: 0.1,
  y: 0.1,
  width: 0.2,
  height: 0.2,
  ocrText: "\u3053\u3093",
  sourceLanguage: "ja",
  confidence: 0.9,
  angle: 0,
  textColorFg: null,
  textColorBg: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OCR_SERVICE_URL = "http://ocr:8000";
  mockReadFile.mockResolvedValue(Buffer.from([1]));
  mockMetadata.mockResolvedValue({ width: 1000, height: 2000, orientation: undefined });
  mockPrepareSidecarImage.mockResolvedValue({
    image: Buffer.from([1]),
    mimeType: "image/png",
    width: 1000,
    height: 2000,
    resized: false,
  });
  mockRegionFindMany.mockResolvedValue([]);
  mockRenderInpaintedPage.mockResolvedValue(Buffer.from([9, 9, 9]));
  mockStoreInpaintedPage.mockResolvedValue(true);
});

describe("scanPost", () => {
  it("persists regions with translations and marks the post COMPLETE", async () => {
    mockScanImage.mockResolvedValue([
      { minX: 100, minY: 200, maxX: 300, maxY: 600, ocrText: "\u3053\u3093", sourceLanguage: "ja", confidence: 0.9, angle: 0, textColorFg: "#111111", textColorBg: "#eeeeee" },
    ]);
    mockTranslateTexts.mockResolvedValue({ translations: ["Hey"], targetLang: "en" });

    const outcome = await scanPost(POST);

    expect(outcome.hasText).toBe(true);
    expect(outcome.translationFailed).toBe(false);
    expect(outcome.regions[0]).toMatchObject({
      ocrText: "\u3053\u3093",
      translatedText: "Hey",
      textColorFg: "#111111",
      textColorBg: "#eeeeee",
    });
    expect(typeof outcome.regions[0].cropVersion).toBe("number");
    expect(mockRegionDeleteMany).toHaveBeenCalledWith({ where: { postId: 7 } });
    expect(mockRegionCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          postId: 7,
          readingOrder: 0,
          translatedText: "Hey",
          targetLanguage: "en",
          textColorFg: "#111111",
          textColorBg: "#eeeeee",
        }),
      ],
    });
    expect(mockPostUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: expect.objectContaining({ ocrStatus: "COMPLETE" }),
    });
    expect(Object.keys(outcome.regions[0]).sort()).toEqual([
      "cropVersion",
      "height",
      "ocrText",
      "readingOrder",
      "sourceLanguage",
      "textColorBg",
      "textColorFg",
      "translatedText",
      "width",
      "x",
      "y",
    ]);
    const createdRows = mockRegionCreateMany.mock.calls.at(-1)?.[0].data;
    expect(Object.keys(createdRows[0]).sort()).toEqual([
      "angle",
      "confidence",
      "height",
      "ocrText",
      "postId",
      "readingOrder",
      "sourceLanguage",
      "targetLanguage",
      "textColorBg",
      "textColorFg",
      "translatedText",
      "width",
      "x",
      "y",
    ]);
  });

  it("sends a prepared sidecar image and normalizes returned boxes against its dimensions", async () => {
    mockPrepareSidecarImage.mockResolvedValueOnce({
      image: Buffer.from([5, 6, 7]),
      mimeType: "image/jpeg",
      width: 500,
      height: 1000,
      resized: true,
    });
    mockScanImage.mockResolvedValue([
      { minX: 50, minY: 200, maxX: 150, maxY: 500, ocrText: "こん", sourceLanguage: "ja", confidence: 0.9, angle: 0, textColorFg: "#111111", textColorBg: "#eeeeee" },
    ]);
    mockTranslateTexts.mockResolvedValue({ translations: ["Hey"], targetLang: "en" });

    await scanPost(POST);

    expect(mockPrepareSidecarImage).toHaveBeenCalledWith(Buffer.from([1]), "image/png");
    expect(mockScanImage).toHaveBeenCalledWith(Buffer.from([5, 6, 7]), "image/jpeg", { signal: undefined });
    expect(mockRegionCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          x: 0.1,
          y: 0.2,
          width: 0.2,
          height: 0.3,
        }),
      ],
    });
  });

  it("stores a full-page inpaint when text regions are detected", async () => {
    mockScanImage.mockResolvedValue([
      { minX: 100, minY: 200, maxX: 300, maxY: 600, ocrText: "こん", sourceLanguage: "ja", confidence: 0.9, angle: 0, textColorFg: "#111111", textColorBg: "#eeeeee" },
    ]);
    mockTranslateTexts.mockResolvedValue({ translations: ["Hey"], targetLang: "en" });

    await scanPost(POST);

    expect(mockRenderInpaintedPage).toHaveBeenCalledWith(Buffer.from([1]), "image/png", { signal: undefined });
    expect(mockStoreInpaintedPage).toHaveBeenCalledWith(POST.hash, Buffer.from([9, 9, 9]));
  });


  it("returns hasText false and persists COMPLETE with zero regions", async () => {
    mockScanImage.mockResolvedValue([]);
    const outcome = await scanPost(POST);
    expect(outcome.hasText).toBe(false);
    expect(mockRegionCreateMany).not.toHaveBeenCalled();
    expect(mockPostUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: expect.objectContaining({ ocrStatus: "COMPLETE" }),
    });
    expect(mockTranslateTexts).not.toHaveBeenCalled();
  });

  it("persists regions without translations when the LLM fails (translationFailed)", async () => {
    mockScanImage.mockResolvedValue([
      { minX: 0, minY: 0, maxX: 10, maxY: 10, ocrText: "\u3042", sourceLanguage: "ja", confidence: null, angle: null },
    ]);
    mockTranslateTexts.mockRejectedValue(new Error("provider down"));

    const outcome = await scanPost(POST);
    expect(outcome.translationFailed).toBe(true);
    expect(outcome.regions[0].translatedText).toBeNull();
    expect(mockPostUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: expect.objectContaining({ ocrStatus: "COMPLETE" }),
    });
  });

  it("persists OCR-only regions and marks COMPLETE when translation hits a 401", async () => {
    mockScanImage.mockResolvedValue([
      { minX: 0, minY: 0, maxX: 10, maxY: 10, ocrText: "\u3042", sourceLanguage: "ja", confidence: 0.5, angle: 0 },
    ]);
    mockTranslateTexts.mockRejectedValue(new OpenRouterApiError("unauthorized", 401));

    const outcome = await scanPost(POST);
    expect(outcome.hasText).toBe(true);
    expect(outcome.translationFailed).toBe(true);
    expect(outcome.regions[0].translatedText).toBeNull();
    expect(mockPostUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: expect.objectContaining({ ocrStatus: "COMPLETE" }),
    });
  });

  it("marks FAILED and rethrows when the sidecar is unavailable", async () => {
    mockScanImage.mockRejectedValue(new OcrServiceUnavailableError("down"));
    await expect(scanPost(POST)).rejects.toBeInstanceOf(OcrServiceUnavailableError);
    expect(mockPostUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { ocrStatus: "FAILED" },
    });
    expect(mockRegionDeleteMany).not.toHaveBeenCalled();
  });

  it("leaves the post's status untouched and rethrows when the sidecar is busy", async () => {
    // Busy is transient and the route answers with a retryable 503; flipping
    // the post to FAILED would exclude it from default (PENDING-only) batches.
    mockScanImage.mockRejectedValue(new OcrServiceBusyError("worker occupied"));
    await expect(scanPost(POST)).rejects.toBeInstanceOf(OcrServiceBusyError);
    expect(mockPostUpdate).not.toHaveBeenCalled();
  });

  it("marks FAILED and throws OcrFileMissingError when the file is unreadable", async () => {
    mockReadFile.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    await expect(scanPost(POST)).rejects.toBeInstanceOf(OcrFileMissingError);
    expect(mockPostUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { ocrStatus: "FAILED" },
    });
  });

  it("serializes crop writes and persistence for the same hash", async () => {
    const events: string[] = [];
    let releaseFirst!: () => void;
    const first = withPostCropWriteLock(POST.hash, async () => {
      events.push("first-start");
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      events.push("first-end");
    });
    const second = withPostCropWriteLock(POST.hash, async () => {
      events.push("second-start");
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual(["first-start"]);
    releaseFirst();
    await Promise.all([first, second]);

    expect(events).toEqual(["first-start", "first-end", "second-start"]);
  });

  it("marks FAILED and rethrows when the persistence transaction fails", async () => {
    mockScanImage.mockResolvedValue([
      { minX: 0, minY: 0, maxX: 10, maxY: 10, ocrText: "\u3042", sourceLanguage: "ja", confidence: 0.9, angle: 0 },
    ]);
    mockTranslateTexts.mockResolvedValue({ translations: ["Hi"], targetLang: "en" });
    const dbError = new Error("db transaction failed");
    mockTransaction.mockRejectedValueOnce(dbError);

    await expect(scanPost(POST)).rejects.toBe(dbError);
    expect(mockPostUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { ocrStatus: "FAILED" },
    });
  });


  it("does not mark FAILED on a recoverable 401 translation error", async () => {
    mockScanImage.mockResolvedValue([
      { minX: 0, minY: 0, maxX: 10, maxY: 10, ocrText: "\u3042", sourceLanguage: "ja", confidence: 0.5, angle: 0 },
    ]);
    mockTranslateTexts.mockRejectedValue(new OpenRouterApiError("unauthorized", 401));

    const outcome = await scanPost(POST);
    expect(outcome.translationFailed).toBe(true);
    expect(mockPostUpdate).not.toHaveBeenCalledWith({
      where: { id: 7 },
      data: { ocrStatus: "FAILED" },
    });
  });

  it("marks FAILED when persistence fails during 401 recovery", async () => {
    mockScanImage.mockResolvedValue([
      { minX: 0, minY: 0, maxX: 10, maxY: 10, ocrText: "\u3042", sourceLanguage: "ja", confidence: 0.5, angle: 0 },
    ]);
    mockTranslateTexts.mockRejectedValue(new OpenRouterApiError("unauthorized", 401));
    const dbError = new Error("db down during recovery");
    mockTransaction.mockRejectedValueOnce(dbError);

    await expect(scanPost(POST)).rejects.toBe(dbError);
    expect(mockPostUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { ocrStatus: "FAILED" },
    });
  });
});

describe("finalizeScan", () => {
  it("stores a provided full-page inpaint and persists the scan as COMPLETE", async () => {
    const page = Buffer.from([9]);

    const outcome = await finalizeScan(POST, [normalized()], ["Hi"], "en", page);

    expect(outcome.hasText).toBe(true);
    expect(mockStoreInpaintedPage).toHaveBeenCalledWith(POST.hash, page);
    expect(mockDeleteInpaintedPage).not.toHaveBeenCalled();
    expect(mockRegionCreateMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ postId: 7, translatedText: "Hi", targetLanguage: "en" })],
    });
    expect(mockPostUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: expect.objectContaining({ ocrStatus: "COMPLETE" }),
    });
  });

  it("deletes any stale full-page inpaint when no page was rendered", async () => {
    await finalizeScan(POST, [normalized()], ["Hi"], "en", null);

    expect(mockDeleteInpaintedPage).toHaveBeenCalledWith(POST.hash);
    expect(mockStoreInpaintedPage).not.toHaveBeenCalled();
  });
});

describe("translateRegions", () => {
  it("returns failed=true with null translations on client construction failure", async () => {
    mockTranslateTexts.mockRejectedValue(new Error("nope"));
    const result = await translateRegions([normalized()], "en");
    expect(result.failed).toBe(true);
    expect(result.translated).toEqual([null]);
  });

  it("rethrows a 401 OpenRouterApiError (config problem) instead of swallowing it", async () => {
    mockTranslateTexts.mockRejectedValue(new OpenRouterApiError("unauthorized", 401));
    await expect(translateRegions([normalized()], "en")).rejects.toBeInstanceOf(OpenRouterApiError);
  });
});
