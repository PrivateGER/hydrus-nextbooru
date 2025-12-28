"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";

interface FilmstripProps {
  children: ReactNode;
  /** CSS color for gradient (e.g., "rgb(39 39 42)" for zinc-800) */
  gradientColor?: string;
  className?: string;
}

/**
 * Horizontal scrollable filmstrip with gradient fade indicators.
 * Shows left/right gradients when content is scrollable in that direction.
 */
export function Filmstrip({
  children,
  gradientColor = "rgb(39 39 42)", // zinc-800
  className = ""
}: FilmstripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;

    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, []);

  return (
    <div className="relative">
      {/* Left gradient fade */}
      <div
        className={`pointer-events-none absolute left-0 top-0 bottom-2 z-10 w-12 transition-opacity duration-200 ${
          canScrollLeft ? "opacity-100" : "opacity-0"
        }`}
        style={{ background: `linear-gradient(to right, ${gradientColor}, transparent)` }}
      />

      {/* Right gradient fade */}
      <div
        className={`pointer-events-none absolute right-0 top-0 bottom-2 z-10 w-12 transition-opacity duration-200 ${
          canScrollRight ? "opacity-100" : "opacity-0"
        }`}
        style={{ background: `linear-gradient(to left, ${gradientColor}, transparent)` }}
      />

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className={`flex gap-3 overflow-x-auto pb-2 snap-x scroll-smooth ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
