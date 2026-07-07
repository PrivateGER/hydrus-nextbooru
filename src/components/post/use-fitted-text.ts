"use client";

import { useEffect, useState, type RefObject } from "react";

const MIN_PX = 9;
const MAX_PX = 28;

// Must match the rendered span's `leading-tight`.
const LINE_HEIGHT = 1.25;

/** Largest integer font size in [9,28] whose measured text fits the box; floor 9. */
export function pickFittedFontSize(opts: {
  boxWidthPx: number;
  boxHeightPx: number;
  measure: (fontSizePx: number) => { width: number; height: number };
}): number {
  let lo = MIN_PX;
  let hi = MAX_PX;
  let best = MIN_PX;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const { width, height } = opts.measure(mid);
    if (width <= opts.boxWidthPx && height <= opts.boxHeightPx) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

/** Font size that fits `text` into the referenced box; re-fits on resize/text change. */
export function useFittedText<T extends HTMLElement>(
  text: string,
  boxRef: RefObject<T | null>,
): number {
  const [fontSize, setFontSize] = useState(MIN_PX);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    const fit = () => {
      const rect = box.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      // Mirror the rendered span so the measured layout matches what paints:
      // the box's own font metrics (family/weight/style/tracking), normal
      // word-breaking so an over-wide word forces a smaller size instead of
      // breaking mid-word, and overflow:hidden so scrollWidth's overflow
      // report is well-defined across engines (spec ties it to the scroll
      // container). break-words on the span is only a floor-case safety net.
      const cs = getComputedStyle(box);
      const probe = document.createElement("div");
      probe.style.cssText = `position:absolute;visibility:hidden;left:-9999px;top:0;box-sizing:border-box;overflow:hidden;white-space:normal;word-break:normal;overflow-wrap:normal;line-height:${LINE_HEIGHT};width:${rect.width}px;`;
      probe.style.fontFamily = cs.fontFamily;
      probe.style.fontWeight = cs.fontWeight;
      probe.style.fontStyle = cs.fontStyle;
      probe.style.letterSpacing = cs.letterSpacing;
      probe.textContent = text;
      document.body.appendChild(probe);
      try {
        const size = pickFittedFontSize({
          boxWidthPx: rect.width,
          boxHeightPx: rect.height,
          measure: (px) => {
            probe.style.fontSize = `${px}px`;
            return { width: probe.scrollWidth, height: probe.scrollHeight };
          },
        });
        setFontSize(size);
      } finally {
        probe.remove();
      }
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    // A late webfont swap (next/font Geist uses font-display:swap) changes glyph
    // metrics without changing box geometry, so ResizeObserver never fires for
    // it; re-fit once fonts settle so the initial fallback-metric size is
    // corrected instead of lingering as a break-words fallback.
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) fit();
    });
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [text, boxRef]);

  return fontSize;
}
