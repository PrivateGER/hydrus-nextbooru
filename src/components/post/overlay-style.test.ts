import { describe, it, expect } from "vitest";
import { regionBoxStyle, tooltipBelow, typesetTextStyle } from "./overlay-style";

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

describe("typesetTextStyle", () => {
  it("uses region text colors for fill and halo", () => {
    expect(
      typesetTextStyle({ textColorFg: "#abcdef", textColorBg: "#123456" }, 14)
    ).toEqual({
      fontSize: 14,
      color: "#abcdef",
      textShadow: "0 0 3px #123456, 0 0 1px #123456",
    });
  });

  it("falls back to #111 fill and #fff halo when colors are null", () => {
    expect(typesetTextStyle({ textColorFg: null, textColorBg: null }, 9)).toEqual({
      fontSize: 9,
      color: "#111",
      textShadow: "0 0 3px #fff, 0 0 1px #fff",
    });
  });
});
