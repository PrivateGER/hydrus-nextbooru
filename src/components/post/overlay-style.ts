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

/** Parse a #rgb / #rrggbb color to [r,g,b] in 0-255, or null when unparseable. */
function parseHexColor(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const h = match[1];
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** sRGB relative luminance (WCAG), 0 (black) to 1 (white); null when unparseable. */
export function relativeLuminance(hex: string): number | null {
  const rgb = parseHexColor(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio (1–21) between two colors; null when either is unparseable. */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Inline style for client-composited typeset text over the LaMa-inpainted page.
 *
 * The fill is the sidecar-reported foreground color. When that fill has enough
 * contrast against its reported background (which, post-inpaint, approximates
 * the pixels behind the glyph) the subtle same-background halo is kept — it
 * preserves the sidecar's intent for the normal case. When the fill blends into
 * its background (the classic white-on-white bubble, or an unreported bg) that
 * halo is useless, so the glyph is delineated with a hard contrast outline
 * derived from the fill's own luminance — legible over any background.
 */
export function typesetTextStyle(
  region: { textColorFg: string | null; textColorBg: string | null },
  fontSizePx: number,
): CSSProperties {
  const fill = region.textColorFg ?? "#111";
  const bg = region.textColorBg;
  // 3:1 is WCAG AA for large text; typeset glyphs are large/bold enough.
  const ratio = bg ? contrastRatio(fill, bg) : null;
  if (ratio !== null && ratio >= 3) {
    return { fontSize: fontSizePx, color: fill, textShadow: `0 0 3px ${bg}, 0 0 1px ${bg}` };
  }

  // Outline contrasts the fill (WCAG crossover ~0.179); unparseable → light → dark outline.
  const outline = (relativeLuminance(fill) ?? 1) >= 0.179 ? "#000000" : "#ffffff";
  // Scale the outline with the text so it stays proportionate.
  const r = fontSizePx >= 20 ? 2 : 1;
  const dirs: ReadonlyArray<readonly [number, number]> = [
    [r, 0], [-r, 0], [0, r], [0, -r],
    [r, r], [-r, r], [r, -r], [-r, -r],
  ];
  const textShadow = dirs.map(([x, y]) => `${x}px ${y}px 0 ${outline}`).join(", ");
  return { fontSize: fontSizePx, color: fill, textShadow };
}
