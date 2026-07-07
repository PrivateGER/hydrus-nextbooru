import { describe, it, expect } from "vitest";
import { contrastRatio, regionBoxStyle, relativeLuminance, tooltipBelow, typesetTextStyle } from "./overlay-style";

function expectOutlineShadow(textShadow: unknown, outline: "#000000" | "#ffffff", radius: 1 | 2) {
  expect(typeof textShadow).toBe("string");
  const segments = (textShadow as string).split(", ");
  expect(segments).toHaveLength(8);
  expect(segments.every((segment) => segment.endsWith(`0 ${outline}`))).toBe(true);
  const actualOffsets = segments.map((segment) => segment.replace(` 0 ${outline}`, "")).sort();
  const expectedOffsets = [
    `${radius}px 0px`,
    `-${radius}px 0px`,
    `0px ${radius}px`,
    `0px -${radius}px`,
    `${radius}px ${radius}px`,
    `-${radius}px ${radius}px`,
    `${radius}px -${radius}px`,
    `-${radius}px -${radius}px`,
  ].sort();
  expect(actualOffsets).toEqual(expectedOffsets);
}

describe("regionBoxStyle", () => {
  it("converts normalized coords to percent strings", () => {
    expect(regionBoxStyle({ x: 0.1, y: 0.25, width: 0.2, height: 0.5 })).toEqual({
      left: "10%",
      top: "25%",
      width: "20%",
      height: "50%",
    });
  });

  it("rounds long fractions to 4 decimals", () => {
    const style = regionBoxStyle({ x: 1 / 3, y: 0, width: 2 / 3, height: 1 });
    expect(style.left).toBe("33.3333%");
    expect(style.width).toBe("66.6667%");
  });
});

describe("tooltipBelow", () => {
  it("places tooltip below for regions near the top edge", () => {
    expect(tooltipBelow({ y: 0.1 })).toBe(true);
    expect(tooltipBelow({ y: 0.4 })).toBe(false);
  });
});

describe("relativeLuminance", () => {
  it("computes WCAG endpoints while accepting short and hashless hex colors", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1);
    expect(relativeLuminance("000000")).toBeCloseTo(0);
    expect(relativeLuminance("#fff")).toBeCloseTo(1);
  });

  it("returns null for unparseable colors", () => {
    expect(relativeLuminance("nope")).toBeNull();
    expect(relativeLuminance("")).toBeNull();
    expect(relativeLuminance("#12")).toBeNull();
  });
});

describe("contrastRatio", () => {
  it("computes WCAG contrast endpoints and identical-color minimums", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21);
    expect(contrastRatio("#abcdef", "#abcdef")).toBeCloseTo(1);
  });

  it("is symmetric for parsed colors", () => {
    const forward = contrastRatio("#123456", "#fedcba");
    const reverse = contrastRatio("#fedcba", "#123456");

    expect(forward).not.toBeNull();
    expect(reverse).not.toBeNull();
    expect(forward!).toBeCloseTo(reverse!);
  });

  it("returns null when either color cannot be parsed", () => {
    expect(contrastRatio("nope", "#ffffff")).toBeNull();
    expect(contrastRatio("#000000", "")).toBeNull();
  });
});

describe("typesetTextStyle", () => {
  it("outlines white text on a white background with a dark 8-direction shadow", () => {
    const style = typesetTextStyle({ textColorFg: "#ffffff", textColorBg: "#ffffff" }, 18);

    expect(style.fontSize).toBe(18);
    expect(style.color).toBe("#ffffff");
    expect("#000000").not.toBe(style.color);
    expectOutlineShadow(style.textShadow, "#000000", 1);
  });

  it("keeps the subtle background halo when fill and background have adequate contrast", () => {
    expect(typesetTextStyle({ textColorFg: "#111111", textColorBg: "#ffffff" }, 14)).toEqual({
      fontSize: 14,
      color: "#111111",
      textShadow: "0 0 3px #ffffff, 0 0 1px #ffffff",
    });
  });

  it("keeps the halo as soon as contrast reaches the 3:1 threshold", () => {
    expect(contrastRatio("#000000", "#5a5a5a")).toBeGreaterThanOrEqual(3);
    expect(contrastRatio("#000000", "#5a5a5a")).toBeLessThan(3.1);

    expect(typesetTextStyle({ textColorFg: "#000000", textColorBg: "#5a5a5a" }, 16)).toEqual({
      fontSize: 16,
      color: "#000000",
      textShadow: "0 0 3px #5a5a5a, 0 0 1px #5a5a5a",
    });
  });

  it("outlines dark text on a dark background with a light shadow", () => {
    const style = typesetTextStyle({ textColorFg: "#000000", textColorBg: "#000000" }, 18);

    expect(style.fontSize).toBe(18);
    expect(style.color).toBe("#000000");
    expectOutlineShadow(style.textShadow, "#ffffff", 1);
  });

  it("uses an outline when no background color is available", () => {
    const style = typesetTextStyle({ textColorFg: "#ffffff", textColorBg: null }, 20);

    expect(style.fontSize).toBe(20);
    expect(style.color).toBe("#ffffff");
    expectOutlineShadow(style.textShadow, "#000000", 2);
  });

  it("uses a light outline for the fallback dark fill when foreground and background are missing", () => {
    const style = typesetTextStyle({ textColorFg: null, textColorBg: null }, 9);

    expect(style.fontSize).toBe(9);
    expect(style.color).toBe("#111");
    expectOutlineShadow(style.textShadow, "#ffffff", 1);
  });
});
