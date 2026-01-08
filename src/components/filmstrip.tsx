"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface FilmstripProps {
  children: ReactNode;
  /** CSS color for gradient - light mode (e.g., "rgb(228 228 231)" for zinc-200) */
  gradientColorLight?: string;
  /** CSS color for gradient - dark mode (e.g., "rgb(39 39 42)" for zinc-800) */
  gradientColorDark?: string;
  className?: string;
  /** Show navigation buttons (default: true) */
  showButtons?: boolean;
  /** Scroll amount per click in pixels (default: 300) */
  scrollAmount?: number;
}

/**
 * Horizontal scrollable filmstrip with gradient fade indicators and navigation buttons.
 * Shows left/right gradients and buttons when content is scrollable in that direction.
 */
export function Filmstrip({
  children,
  gradientColorLight = "rgb(228 228 231)", // zinc-200
  gradientColorDark = "rgb(39 39 42)", // zinc-800
  className = "",
  showButtons = true,
  scrollAmount = 300,
}: FilmstripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  const scroll = useCallback((direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;

    const amount = direction === "left" ? -scrollAmount : scrollAmount;
    el.scrollBy({ left: amount, behavior: "smooth" });
  }, [scrollAmount]);

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
  }, [updateScrollState]);

  return (
    <div className="group/filmstrip relative">
      {/* Left gradient fade */}
      <div
        className={`pointer-events-none absolute left-0 top-0 bottom-2 z-10 w-16 transition-opacity duration-200 ${
          canScrollLeft ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className="h-full w-full dark:hidden"
          style={{ background: `linear-gradient(to right, ${gradientColorLight}, transparent)` }}
        />
        <div
          className="h-full w-full hidden dark:block"
          style={{ background: `linear-gradient(to right, ${gradientColorDark}, transparent)` }}
        />
      </div>

      {/* Right gradient fade */}
      <div
        className={`pointer-events-none absolute right-0 top-0 bottom-2 z-10 w-16 transition-opacity duration-200 ${
          canScrollRight ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className="h-full w-full dark:hidden"
          style={{ background: `linear-gradient(to left, ${gradientColorLight}, transparent)` }}
        />
        <div
          className="h-full w-full hidden dark:block"
          style={{ background: `linear-gradient(to left, ${gradientColorDark}, transparent)` }}
        />
      </div>

      {/* Left scroll button */}
      {showButtons && canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/70 p-2 text-white opacity-0 transition-opacity hover:bg-black/90 group-hover/filmstrip:opacity-100 focus:opacity-100"
          aria-label="Scroll left"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
      )}

      {/* Right scroll button */}
      {showButtons && canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/70 p-2 text-white opacity-0 transition-opacity hover:bg-black/90 group-hover/filmstrip:opacity-100 focus:opacity-100"
          aria-label="Scroll right"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      )}

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
