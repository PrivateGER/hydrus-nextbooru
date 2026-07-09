"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import {
  EyeIcon,
  EyeSlashIcon,
  PaintBrushIcon,
  LanguageIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { regionBoxStyle, tooltipBelow, typesetTextStyle } from "./overlay-style";
import { useFittedText } from "./use-fitted-text";

export interface OverlayRegion {
  readingOrder: number;
  x: number;
  y: number;
  width: number;
  height: number;
  ocrText: string;
  translatedText: string | null;
  sourceLanguage: string | null;
  textColorFg: string | null;
  textColorBg: string | null;
  cropVersion: number;
}

export type OverlayMode = "hidden" | "notes" | "typeset";

interface TextOverlayProps {
  hash: string;
  initialRegions: OverlayRegion[];
  ocrEnabled: boolean;
}

const MODE_KEY = "ocrOverlayMode";
const LEGACY_VISIBILITY_KEY = "ocrOverlayVisible";
const MODE_CHANGE_EVENT = "ocr-overlay-mode-change";

/**
 * The persisted overlay mode is read through useSyncExternalStore so the
 * stored value participates in render directly (no mount effect + setState,
 * and overlay instances on the same page stay in sync).
 */
function subscribeToStoredMode(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(MODE_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(MODE_CHANGE_EVENT, callback);
  };
}

/** Read-only snapshot: peeks at the legacy flag but never writes (migration
 * happens in an effect). Returns null when nothing is stored. */
function readStoredMode(): OverlayMode | null {
  const stored = localStorage.getItem(MODE_KEY);
  if (stored === "hidden" || stored === "notes" || stored === "typeset") {
    return stored;
  }
  const legacy = localStorage.getItem(LEGACY_VISIBILITY_KEY);
  if (legacy !== null) {
    return legacy === "false" ? "hidden" : "typeset";
  }
  return null;
}

function writeStoredMode(mode: OverlayMode) {
  localStorage.setItem(MODE_KEY, mode);
  window.dispatchEvent(new Event(MODE_CHANGE_EVENT));
}

/** aria-label for the toolbar button, naming the mode it will switch to next. */
const MODE_LABEL: Record<OverlayMode, string> = {
  hidden: "Hide text overlay",
  notes: "Show notes overlay",
  typeset: "Show typeset overlay",
};

/**
 * Danbooru-style hover-note overlay + scan controls for the media viewer.
 * Rendered as a sibling of the full-image link inside the aspect-ratio
 * container, so normalized coords map 1:1 to CSS percentages.
 */
export function TextOverlay({ hash, initialRegions, ocrEnabled }: TextOverlayProps) {
  const router = useRouter();
  const [regions, setRegions] = useState<OverlayRegion[]>(initialRegions);
  const storedMode = useSyncExternalStore(subscribeToStoredMode, readStoredMode, () => null);
  const mode: OverlayMode = storedMode ?? "typeset";
  const [activeRegion, setActiveRegion] = useState<number | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageInpaintFailed, setPageInpaintFailed] = useState(false);

  const hasTypesetContent = regions.length > 0;
  const cropVersion = regions.reduce((max, region) => Math.max(max, region.cropVersion), 0);
  const usePageInpaint = mode === "typeset" && hasTypesetContent && !pageInpaintFailed;

  // Migrate the legacy boolean visibility flag once. Visible used to mean
  // notes-only; now the default visible OCR experience is full-page typeset.
  // readStoredMode already derives the mode from the legacy flag, so this
  // only persists it under the new key (no state update needed).
  useEffect(() => {
    if (localStorage.getItem(MODE_KEY) !== null) return;
    const legacy = localStorage.getItem(LEGACY_VISIBILITY_KEY);
    if (legacy !== null) {
      writeStoredMode(legacy === "false" ? "hidden" : "typeset");
      localStorage.removeItem(LEGACY_VISIBILITY_KEY);
    }
  }, []);

  // Retry page inpainting when the post or its crops change — adjusted during
  // render rather than in an effect.
  const inpaintKey = `${hash}|${cropVersion}`;
  const [prevInpaintKey, setPrevInpaintKey] = useState(inpaintKey);
  if (prevInpaintKey !== inpaintKey) {
    setPrevInpaintKey(inpaintKey);
    setPageInpaintFailed(false);
  }

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

  // Cycle: hidden → notes → (typeset when regions exist, else hidden) → hidden.
  const nextMode: OverlayMode =
    mode === "hidden" ? "notes" : mode === "notes" ? (hasTypesetContent ? "typeset" : "hidden") : "hidden";

  const cycleMode = () => {
    writeStoredMode(nextMode);
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
      {mode !== "hidden" && regions.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-20" data-ocr-overlay>
          {usePageInpaint && (
            // eslint-disable-next-line @next/next/no-img-element -- generated, versioned full-page OCR inpaint that must exactly cover the displayed image
            <img
              src={`/api/ocr-pages/${hash}?v=${cropVersion}`}
              alt=""
              draggable={false}
              onError={() => setPageInpaintFailed(true)}
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
          )}
          {regions.map((region) =>
            mode === "typeset" && usePageInpaint ? (
              <TypesetRegion
                key={`${region.readingOrder}-${region.cropVersion}`}
                region={region}
                activeRegion={activeRegion}
                setActiveRegion={setActiveRegion}
              />
            ) : (
              <NotesRegion
                key={region.readingOrder}
                region={region}
                activeRegion={activeRegion}
                setActiveRegion={setActiveRegion}
              />
            )
          )}
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
            onClick={cycleMode}
            aria-label={MODE_LABEL[nextMode]}
            title={hasTypesetContent ? undefined : "Scan text to enable typeset view"}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
          >
            {mode === "hidden" ? (
              <EyeSlashIcon className="h-5 w-5" />
            ) : mode === "notes" ? (
              <EyeIcon className="h-5 w-5" />
            ) : (
              <PaintBrushIcon className="h-5 w-5" />
            )}
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

interface RegionProps {
  region: OverlayRegion;
  activeRegion: number | null;
  setActiveRegion: Dispatch<SetStateAction<number | null>>;
}

/** Hover/tap tooltip shared by both visible modes: translation + original text. */
function RegionTooltip({ region }: { region: OverlayRegion }) {
  return (
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
  );
}

/** Notes mode: the danbooru-style hover box (unchanged behavior). */
function NotesRegion({ region, activeRegion, setActiveRegion }: RegionProps) {
  return (
    <div
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
      {activeRegion === region.readingOrder && <RegionTooltip region={region} />}
    </div>
  );
}

/**
 * Typeset mode: centered, auto-fitted translated text over the shared
 * full-page inpaint image rendered by TextOverlay.
 */
function TypesetRegion({ region, activeRegion, setActiveRegion }: RegionProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const text = region.translatedText ?? region.ocrText;
  const fontSize = useFittedText(text, boxRef);

  return (
    <div
      ref={boxRef}
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
        aria-label={text}
        onClick={() =>
          setActiveRegion((prev) => (prev === region.readingOrder ? null : region.readingOrder))
        }
        onBlur={() => setActiveRegion(null)}
        className="pointer-events-auto absolute inset-0 flex h-full w-full items-center justify-center overflow-hidden focus:outline-none"
      >
        <span
          className="pointer-events-none w-full text-center leading-tight break-words"
          style={typesetTextStyle(region, fontSize)}
        >
          {text}
        </span>
      </button>
      {activeRegion === region.readingOrder && <RegionTooltip region={region} />}
    </div>
  );
}
