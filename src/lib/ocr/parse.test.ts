import { describe, it, expect } from "vitest";
import { parseSidecarResponse } from "./parse";
import { OcrServiceResponseError } from "./errors";

const region = (overrides: Record<string, unknown> = {}) => ({
  minX: 10,
  minY: 20,
  maxX: 110,
  maxY: 220,
  angle: 0,
  prob: 0.97,
  text: { ENG: "\u3053\u3093\u306b\u3061\u306f", ja: "\u3053\u3093\u306b\u3061\u306f" },
  ...overrides,
});

describe("parseSidecarResponse", () => {
  it("extracts text from the 2-letter langid key and maps fields", () => {
    const result = parseSidecarResponse({ translations: [region()] });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      minX: 10,
      minY: 20,
      maxX: 110,
      maxY: 220,
      ocrText: "\u3053\u3093\u306b\u3061\u306f",
      sourceLanguage: "ja",
      confidence: 0.97,
      angle: 0,
      textColorFg: null,
      textColorBg: null,
    });
  });

  it("falls back to the first non-empty text value when no 2-letter key exists", () => {
    const result = parseSidecarResponse({
      translations: [region({ text: { ENG: "hello" } })],
    });
    expect(result[0].ocrText).toBe("hello");
    expect(result[0].sourceLanguage).toBeNull();
  });

  it("drops regions with empty/whitespace-only text (translator 'none' shape)", () => {
    const result = parseSidecarResponse({
      translations: [region({ text: { ENG: "", ja: "   " } })],
    });
    expect(result).toHaveLength(0);
  });

  it("drops degenerate boxes", () => {
    const result = parseSidecarResponse({
      translations: [
        region({ maxX: 10 }), // minX === maxX
        region({ minY: 220 }), // minY === maxY
      ],
    });
    expect(result).toHaveLength(0);
  });

  it("tolerates missing optional prob/angle", () => {
    const result = parseSidecarResponse({
      translations: [region({ prob: undefined, angle: undefined })],
    });
    expect(result[0].confidence).toBeNull();
    expect(result[0].angle).toBeNull();
  });

  it("extracts text colors when present", () => {
    const result = parseSidecarResponse({
      translations: [
        region({
          text_color: { fg: [0, 0, 0], bg: [255, 255, 255] },
        }),
      ],
    });
    expect(result[0].textColorFg).toBe("#000000");
    expect(result[0].textColorBg).toBe("#ffffff");
  });

  it("tolerates missing text_color", () => {
    const result = parseSidecarResponse({
      translations: [region()],
    });
    expect(result[0].textColorFg).toBeNull();
    expect(result[0].textColorBg).toBeNull();
  });

  it("tolerates malformed color values without throwing", () => {
    const result = parseSidecarResponse({
      translations: [
        region({
          text_color: { fg: [999, -1, "x"], bg: "nope" },
        }),
      ],
    });
    expect(result[0].textColorFg).toBeNull();
    expect(result[0].textColorBg).toBeNull();
  });

  it("clamps color channels into 0-255", () => {
    const result = parseSidecarResponse({
      translations: [region({ text_color: { fg: [12.6, 300, -5], bg: [1, 2, 3] } })],
    });
    expect(result[0].textColorFg).toBeNull(); // out-of-range channel invalidates
    expect(result[0].textColorBg).toBe("#010203");
  });

  it("returns [] for zero regions", () => {
    expect(parseSidecarResponse({ translations: [] })).toEqual([]);
  });

  it("throws OcrServiceResponseError on structurally invalid payloads", () => {
    expect(() => parseSidecarResponse(null)).toThrow(OcrServiceResponseError);
    expect(() => parseSidecarResponse({})).toThrow(OcrServiceResponseError);
    expect(() => parseSidecarResponse({ translations: "nope" })).toThrow(OcrServiceResponseError);
    expect(() => parseSidecarResponse({ translations: [{ text: {} }] })).toThrow(
      OcrServiceResponseError
    );
    expect(() =>
      parseSidecarResponse({ translations: [region({ minX: "x" })] })
    ).toThrow(OcrServiceResponseError);
  });
});
