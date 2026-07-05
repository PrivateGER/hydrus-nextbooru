import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRm, mockMkdir, mockToFile, mockSharp } = vi.hoisted(() => {
  const mockToFile = vi.fn();
  return {
    mockRm: vi.fn(),
    mockMkdir: vi.fn(),
    mockToFile,
    mockSharp: vi.fn(() => ({ webp: vi.fn(() => ({ toFile: mockToFile })) })),
  };
});
vi.mock("fs/promises", () => ({ rm: mockRm, mkdir: mockMkdir }));
vi.mock("sharp", () => ({ default: mockSharp }));

import { storeCrops, deleteCrops, buildCropFilePath } from "./crops";
import type { NormalizedRegion } from "./types";

const region = (overrides: Partial<NormalizedRegion> = {}): NormalizedRegion => ({
  readingOrder: 0, x: 0, y: 0, width: 0.5, height: 0.5,
  ocrText: "t", sourceLanguage: "ja", confidence: 1, angle: 0,
  cropBase64: Buffer.from("img").toString("base64"), textColorFg: null, textColorBg: null,
  ...overrides,
});

const HASH = "a".repeat(64);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.THUMBNAIL_PATH = "/thumbs";
  mockRm.mockResolvedValue(undefined);
  mockMkdir.mockResolvedValue(undefined);
  mockToFile.mockResolvedValue(undefined);
});

describe("storeCrops", () => {
  it("wipes the dir, then writes one webp per crop region and reports flags", async () => {
    const flags = await storeCrops(HASH, [region(), region({ readingOrder: 1, cropBase64: null })]);
    expect(mockRm).toHaveBeenCalledWith(expect.stringContaining(HASH), { recursive: true, force: true });
    expect(mockMkdir).toHaveBeenCalledWith(expect.stringContaining(HASH), { recursive: true });
    expect(flags).toEqual([true, false]);
    expect(mockToFile).toHaveBeenCalledTimes(1);
    expect(mockToFile).toHaveBeenCalledWith(buildCropFilePath(HASH, 0));
  });

  it("degrades a region to false when its write fails, without throwing", async () => {
    mockToFile.mockRejectedValueOnce(new Error("disk full")).mockResolvedValueOnce(undefined);
    const flags = await storeCrops(HASH, [region(), region({ readingOrder: 1 })]);
    expect(flags).toEqual([false, true]);
  });

  it("returns all-false when the directory cannot be prepared", async () => {
    mockMkdir.mockRejectedValueOnce(new Error("ro fs"));
    const flags = await storeCrops(HASH, [region(), region({ readingOrder: 1 })]);
    expect(flags).toEqual([false, false]);
    expect(mockToFile).not.toHaveBeenCalled();
  });

  it("wipes before writing (recorded rm -> mkdir -> write ordering)", async () => {
    await storeCrops(HASH, [region()]);
    const rmOrder = mockRm.mock.invocationCallOrder[0];
    const mkdirOrder = mockMkdir.mock.invocationCallOrder[0];
    const writeOrder = mockToFile.mock.invocationCallOrder[0];
    expect(rmOrder).toBeLessThan(mkdirOrder);
    expect(mkdirOrder).toBeLessThan(writeOrder);
  });
});

describe("deleteCrops", () => {
  it("removes the dir and swallows errors", async () => {
    mockRm.mockRejectedValueOnce(new Error("gone"));
    await expect(deleteCrops(HASH)).resolves.toBeUndefined();
  });
});
