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

/**
 * Inline style for client-composited typeset text: the sidecar-reported
 * foreground color with a halo built from the background color so text stays
 * legible over any crop. Falls back to dark-on-light defaults when the
 * sidecar did not report colors.
 */
export function typesetTextStyle(
  region: { textColorFg: string | null; textColorBg: string | null },
  fontSizePx: number,
): CSSProperties {
  const bg = region.textColorBg ?? "#fff";
  return {
    fontSize: fontSizePx,
    color: region.textColorFg ?? "#111",
    textShadow: `0 0 3px ${bg}, 0 0 1px ${bg}`,
  };
}
