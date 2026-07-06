"use client";

import { useEffect, useState, type RefObject } from "react";

const MIN_PX = 9;
const MAX_PX = 28;

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

      const probe = document.createElement("div");
      probe.style.cssText = `position:absolute;visibility:hidden;left:-9999px;top:0;width:${rect.width}px;word-break:break-word;line-height:1.25;padding:2px;`;
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
    return () => observer.disconnect();
  }, [text, boxRef]);

  return fontSize;
}
