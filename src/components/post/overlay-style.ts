import type { CSSProperties } from "react";

const pct = (value: number): string => `${Number((value * 100).toFixed(4))}%`;

/** CSS percentage placement for a normalized region box. */
export function regionBoxStyle(region: {
  x: number;
  y: number;
  width: number;
  height: number;
}): CSSProperties {
  return {
    left: pct(region.x),
    top: pct(region.y),
    width: pct(region.width),
    height: pct(region.height),
  };
}

/** Tooltips flip below the box when the region sits in the top quarter. */
export function tooltipBelow(region: { y: number }): boolean {
  return region.y < 0.25;
}
