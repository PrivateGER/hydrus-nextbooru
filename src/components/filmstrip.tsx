"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";

interface FilmstripProps {
  children: ReactNode;
  /** Background color for gradients (should match container) */
  bgColor?: string;
  className?: string;
}

/**
 * Horizontal scrollable filmstrip with gradient fade indicators.
 * Shows left/right gradients when content is scrollable in that direction.
 */
export function Filmstrip({ children, bgColor = "zinc-800", className = "" }: FilmstripProps) {
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
        className={`pointer-events-none absolute left-0 top-0 bottom-2 z-10 w-12 bg-gradient-to-r from-${bgColor} to-transparent transition-opacity duration-200 ${
          canScrollLeft ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Right gradient fade */}
      <div
        className={`pointer-events-none absolute right-0 top-0 bottom-2 z-10 w-12 bg-gradient-to-l from-${bgColor} to-transparent transition-opacity duration-200 ${
          canScrollRight ? "opacity-100" : "opacity-0"
        }`}
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
