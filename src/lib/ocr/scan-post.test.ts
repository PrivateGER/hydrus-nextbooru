import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as OpenRouterModule from "@/lib/openrouter";

const {
  mockReadFile,
  mockMetadata,
  mockScanImage,
  mockTranslateTexts,
  mockRegionDeleteMany,
  mockRegionCreateMany,
  mockRegionFindMany,
  mockPostUpdate,
  mockTransaction,
  mockStoreCrops,
} = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockMetadata: vi.fn(),
  mockScanImage: vi.fn(),
  mockTranslateTexts: vi.fn(),
  mockRegionDeleteMany: vi.fn(),
  mockRegionCreateMany: vi.fn(),
  mockRegionFindMany: vi.fn(),
  mockPostUpdate: vi.fn(),
  mockTransaction: vi.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  mockStoreCrops: vi.fn(),
}));

vi.mock("fs/promises", () => ({ readFile: mockReadFile }));

vi.mock("sharp", () => ({
  default: vi.fn(() => ({ metadata: mockMetadata })),
}));

vi.mock("./client", () => ({
  scanImage: mockScanImage,
  checkOcrServiceHealth: vi.fn(),
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

vi.mock("./crops", () => ({ storeCrops: mockStoreCrops }));

import { scanPost, translateRegions, OcrFileMissingError } from "./scan-post";
import { OcrServiceUnavailableError } from "./errors";
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
  cropBase64: null,
  textColorFg: null,
  textColorBg: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OCR_SERVICE_URL = "http://ocr:8000";
  mockReadFile.mockResolvedValue(Buffer.from([1]));
  mockMetadata.mockResolvedValue({ width: 1000, height: 2000, orientation: undefined });
  mockRegionFindMany.mockResolvedValue([]);
  mockStoreCrops.mockResolvedValue([true]);
});

describe("scanPost", () => {
  it("persists regions with translations and marks the post COMPLETE", async () => {
    mockScanImage.mockResolvedValue([
      { minX: 100, minY: 200, maxX: 300, maxY: 600, ocrText: "\u3053\u3093", sourceLanguage: "ja", confidence: 0.9, angle: 0, cropBase64: "abc", textColorFg: "#111111", textColorBg: "#eeeeee" },
    ]);
    mockTranslateTexts.mockResolvedValue({ translations: ["Hey"], targetLang: "en" });

    const outcome = await scanPost(POST);

    expect(outcome.hasText).toBe(true);
    expect(outcome.translationFailed).toBe(false);
    expect(outcome.regions[0]).toMatchObject({
      ocrText: "\u3053\u3093",
      translatedText: "Hey",
      hasCrop: true,
      textColorFg: "#111111",
      textColorBg: "#eeeeee",
    });
    expect(typeof outcome.regions[0].cropVersion).toBe("number");
    expect(mockStoreCrops).toHaveBeenCalledWith(
      POST.hash,
      expect.arrayContaining([expect.objectContaining({ readingOrder: 0, cropBase64: "abc" })])
    );
    expect(mockRegionDeleteMany).toHaveBeenCalledWith({ where: { postId: 7 } });
    expect(mockRegionCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          postId: 7,
          readingOrder: 0,
          translatedText: "Hey",
          targetLanguage: "en",
          hasCrop: true,
          textColorFg: "#111111",
          textColorBg: "#eeeeee",
        }),
      ],
    });
    expect(mockPostUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: expect.objectContaining({ ocrStatus: "COMPLETE" }),
    });
  });

  it("persists rows with hasCrop false and still COMPLETE when crop storage fails", async () => {
    mockScanImage.mockResolvedValue([
      { minX: 100, minY: 200, maxX: 300, maxY: 600, ocrText: "\u3053\u3093", sourceLanguage: "ja", confidence: 0.9, angle: 0, cropBase64: "abc", textColorFg: null, textColorBg: null },
    ]);
    mockTranslateTexts.mockResolvedValue({ translations: ["Hey"], targetLang: "en" });
    mockStoreCrops.mockResolvedValue([false]);

    const outcome = await scanPost(POST);

    expect(mockStoreCrops).toHaveBeenCalledWith(POST.hash, expect.any(Array));
    expect(mockRegionCreateMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ postId: 7, hasCrop: false })],
    });
    expect(outcome.regions[0].hasCrop).toBe(false);
    expect(mockPostUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: expect.objectContaining({ ocrStatus: "COMPLETE" }),
    });
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
    expect(mockStoreCrops).toHaveBeenCalledWith(POST.hash, expect.any(Array));
    expect(mockRegionCreateMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ postId: 7, translatedText: null, targetLanguage: null, hasCrop: true })],
    });
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

  it("marks FAILED and throws OcrFileMissingError when the file is unreadable", async () => {
    mockReadFile.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    await expect(scanPost(POST)).rejects.toBeInstanceOf(OcrFileMissingError);
    expect(mockPostUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { ocrStatus: "FAILED" },
    });
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
