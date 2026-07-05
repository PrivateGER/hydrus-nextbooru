import { describe, it, expect } from "vitest";
import { pickFittedFontSize } from "./use-fitted-text";

const linearMeasure = (charsPerLineAt16: number, lines: number) =>
  (fontSizePx: number) => ({
    width: Math.min(charsPerLineAt16 * fontSizePx * 0.6, 10_000),
    height: lines * fontSizePx * 1.3,
  });

describe("pickFittedFontSize", () => {
  it("returns the largest size in range that fits", () => {
    // Height binds strictly inside [9,28]: floor(70/2.6) = 26, so 27 overflows.
    const size = pickFittedFontSize({
      boxWidthPx: 200,
      boxHeightPx: 70,
      measure: (px) => ({ width: px * 6, height: px * 2.6 }),
    });
    expect(size).toBeLessThanOrEqual(28);
    expect(size * 6).toBeLessThanOrEqual(200);
    expect(size * 2.6).toBeLessThanOrEqual(70);
    expect((size + 1) * 2.6).toBeGreaterThan(70); // maximal
  });

  it("caps at 28 for huge boxes", () => {
    expect(
      pickFittedFontSize({ boxWidthPx: 5000, boxHeightPx: 5000, measure: () => ({ width: 1, height: 1 }) })
    ).toBe(28);
  });

  it("floors at 9 even when nothing fits", () => {
    expect(
      pickFittedFontSize({ boxWidthPx: 10, boxHeightPx: 10, measure: linearMeasure(40, 8) })
    ).toBe(9);
  });
});
