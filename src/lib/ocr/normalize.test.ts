import { describe, it, expect } from "vitest";
import { normalizeRegions } from "./normalize";
import type { ParsedRegion } from "./types";

const parsed = (overrides: Partial<ParsedRegion> = {}): ParsedRegion => ({
  minX: 100,
  minY: 200,
  maxX: 300,
  maxY: 600,
  ocrText: "text",
  sourceLanguage: "ja",
  confidence: 0.9,
  angle: 0,
  cropBase64: "aGVsbG8=",
  textColorFg: "#000000",
  textColorBg: "#ffffff",
  ...overrides,
});

describe("normalizeRegions", () => {
  it("normalizes pixel boxes to 0-1 and assigns readingOrder from index", () => {
    const result = normalizeRegions([parsed(), parsed({ minX: 0, maxX: 1000 })], {
      width: 1000,
      height: 2000,
    });
    expect(result[0]).toMatchObject({
      readingOrder: 0,
      x: 0.1,
      y: 0.1,
      width: 0.2,
      height: 0.2,
      cropBase64: "aGVsbG8=",
      textColorFg: "#000000",
      textColorBg: "#ffffff",
    });
    expect(result[1].readingOrder).toBe(1);
    expect(result[1].width).toBe(1);
  });

  it("clamps out-of-range coordinates into [0,1]", () => {
    const result = normalizeRegions(
      [parsed({ minX: -50, minY: -10, maxX: 1200, maxY: 2500 })],
      { width: 1000, height: 2000 }
    );
    expect(result[0].x).toBe(0);
    expect(result[0].y).toBe(0);
    expect(result[0].width).toBe(1);
    expect(result[0].height).toBe(1);
  });

  it("drops boxes with zero area after clamping", () => {
    const result = normalizeRegions(
      [parsed({ minX: 1500, maxX: 1600 })], // entirely right of the image
      { width: 1000, height: 2000 }
    );
    expect(result).toHaveLength(0);
  });

  it("keeps readingOrder dense after drops", () => {
    const result = normalizeRegions(
      [parsed({ minX: 1500, maxX: 1600 }), parsed()],
      { width: 1000, height: 2000 }
    );
    expect(result).toHaveLength(1);
    expect(result[0].readingOrder).toBe(0);
  });

  it("throws RangeError on non-positive dimensions", () => {
    expect(() => normalizeRegions([parsed()], { width: 0, height: 100 })).toThrow(RangeError);
    expect(() => normalizeRegions([parsed()], { width: 100, height: -1 })).toThrow(RangeError);
  });
});
