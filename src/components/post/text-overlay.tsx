"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeSlashIcon, LanguageIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { regionBoxStyle, tooltipBelow } from "./overlay-style";

export interface OverlayRegion {
  readingOrder: number;
  x: number;
  y: number;
  width: number;
  height: number;
  ocrText: string;
  translatedText: string | null;
  sourceLanguage: string | null;
}

interface TextOverlayProps {
  hash: string;
  initialRegions: OverlayRegion[];
  ocrEnabled: boolean;
}

const VISIBILITY_KEY = "ocrOverlayVisible";

/**
 * Danbooru-style hover-note overlay + scan controls for the media viewer.
 * Rendered as a sibling of the full-image link inside the aspect-ratio
 * container, so normalized coords map 1:1 to CSS percentages.
 */
export function TextOverlay({ hash, initialRegions, ocrEnabled }: TextOverlayProps) {
  const router = useRouter();
  const [regions, setRegions] = useState<OverlayRegion[]>(initialRegions);
  const [visible, setVisible] = useState(true);
  const [activeRegion, setActiveRegion] = useState<number | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setVisible(localStorage.getItem(VISIBILITY_KEY) !== "false");
  }, []);

  // While a tooltip is open, dismiss it on Escape or a pointer press that
  // lands outside the overlay's roots (boxes wrapper + toolbar).
  useEffect(() => {
    if (activeRegion === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveRegion(null);
    };
    const handleOutsidePointer = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("[data-ocr-overlay]")) setActiveRegion(null);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handleOutsidePointer);
    };
  }, [activeRegion]);

  const toggleVisible = () => {
    setVisible((prev) => {
      localStorage.setItem(VISIBILITY_KEY, String(!prev));
      return !prev;
    });
  };

  const handleScan = async () => {
    setIsScanning(true);
    setError(null);
    try {
      const response = await fetch(`/api/posts/${hash}/ocr`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Scan failed");
      }
      setRegions(data.regions ?? []);
      if (data.hasText === false) {
        setError("No text found");
      } else if (data.translationFailed) {
        setError("Text found, but translation failed — showing original text");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setIsScanning(false);
    }
  };

  if (!ocrEnabled && regions.length === 0) {
    return null;
  }

  return (
    <>
      {/* Region boxes */}
      {visible && regions.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-20" data-ocr-overlay>
          {regions.map((region) => (
            <div
              key={region.readingOrder}
              className="absolute"
              style={regionBoxStyle(region)}
              onPointerEnter={(e) => {
                if (e.pointerType !== "touch") setActiveRegion(region.readingOrder);
              }}
              onPointerLeave={(e) => {
                if (e.pointerType !== "touch") setActiveRegion(null);
              }}
            >
              <button
                type="button"
                aria-label={region.translatedText ?? region.ocrText}
                onClick={() =>
                  setActiveRegion((prev) => (prev === region.readingOrder ? null : region.readingOrder))
                }
                onBlur={() => setActiveRegion(null)}
                className="pointer-events-auto h-full w-full rounded-sm border border-amber-500/70 bg-amber-300/10 hover:bg-amber-300/20 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              {activeRegion === region.readingOrder && (
                <div
                  role="tooltip"
                  className={`pointer-events-none absolute left-1/2 z-10 w-max max-w-[min(20rem,80vw)] -translate-x-1/2 rounded-md bg-black/85 px-3 py-2 text-sm text-white shadow-lg ${
                    tooltipBelow(region) ? "top-full mt-1" : "bottom-full mb-1"
                  }`}
                >
                  <p>{region.translatedText ?? region.ocrText}</p>
                  {region.translatedText === null ? (
                    <p className="mt-1 text-xs italic text-zinc-400">
                      translation failed — showing original text
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-zinc-400">{region.ocrText}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Toolbar: top-right, hover-reveal like the nav arrows */}
      <div
        data-ocr-overlay
        className="absolute right-2 top-2 z-20 flex gap-2 lg:opacity-0 transition-opacity lg:group-hover:opacity-100"
      >
        {regions.length > 0 && (
          <button
            type="button"
            onClick={toggleVisible}
            aria-label={visible ? "Hide text overlay" : "Show text overlay"}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
          >
            {visible ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
          </button>
        )}
        {ocrEnabled && (
          <button
            type="button"
            onClick={handleScan}
            disabled={isScanning}
            aria-label={regions.length > 0 ? "Rescan text" : "Scan text"}
            title={regions.length > 0 ? "Rescan text (OCR)" : "Scan text (OCR)"}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 disabled:opacity-50"
          >
            {isScanning ? (
              <ArrowPathIcon className="h-5 w-5 animate-spin" />
            ) : (
              <LanguageIcon className="h-5 w-5" />
            )}
          </button>
        )}
      </div>

      {error && (
        <div className="absolute bottom-2 right-2 z-10 rounded-md bg-black/70 px-3 py-1.5 text-xs text-amber-300">
          {error}
        </div>
      )}
    </>
  );
}
