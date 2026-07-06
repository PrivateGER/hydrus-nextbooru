import { OcrServiceResponseError } from "./errors";
import type { ParsedRegion } from "./types";

const LANGID_KEY = /^[a-z]{2}$/;

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const DATA_URI = /^data:image\/[a-z+.-]+;base64,(.+)$/i;

function extractCropBase64(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = DATA_URI.exec(value);
  return match ? match[1] : null;
}

function channelToHex(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 0 || rounded > 255) return null;
  return rounded.toString(16).padStart(2, "0");
}

function rgbToHex(value: unknown): string | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const channels = value.map(channelToHex);
  if (channels.some((c) => c === null)) return null;
  return `#${channels.join("")}`;
}

function extractTextColors(value: unknown): { fg: string | null; bg: string | null } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { fg: null, bg: null };
  }
  return {
    fg: "fg" in value ? rgbToHex(value.fg) : null,
    bg: "bg" in value ? rgbToHex(value.bg) : null,
  };
}

/**
 * Interpret a manga-image-translator TranslationResponse.
 *
 * Contract quirks handled here (and nowhere else):
 * - `text` is a lang-key dict: the source-language key is a 2-letter langid
 *   code ('ja'), target keys are MIT codes ('ENG'). With translator "original"
 *   all values hold the OCR text; prefer the langid key, fall back to the
 *   first non-empty value.
 * - Array order is the sidecar's panel-aware reading order; preserved.
 * - Junk regions (empty text, degenerate boxes) are dropped, not errors.
 *
 * @throws OcrServiceResponseError when the payload is structurally invalid.
 */
export function parseSidecarResponse(payload: unknown): ParsedRegion[] {
  if (
    payload === null ||
    typeof payload !== "object" ||
    !("translations" in payload) ||
    !Array.isArray(payload.translations)
  ) {
    throw new OcrServiceResponseError("Sidecar response has no translations array");
  }

  const regions: ParsedRegion[] = [];

  for (const entry of payload.translations) {
    if (entry === null || typeof entry !== "object") {
      throw new OcrServiceResponseError("Sidecar region is not an object");
    }

    const minX = "minX" in entry ? asFiniteNumber(entry.minX) : null;
    const minY = "minY" in entry ? asFiniteNumber(entry.minY) : null;
    const maxX = "maxX" in entry ? asFiniteNumber(entry.maxX) : null;
    const maxY = "maxY" in entry ? asFiniteNumber(entry.maxY) : null;
    if (minX === null || minY === null || maxX === null || maxY === null) {
      throw new OcrServiceResponseError("Sidecar region has invalid box coordinates");
    }

    const textDict = "text" in entry ? entry.text : undefined;
    if (textDict === null || typeof textDict !== "object" || Array.isArray(textDict)) {
      throw new OcrServiceResponseError("Sidecar region has no text dict");
    }
    // Runtime filter guarantees the string value type the compiler can't track.
    const entries = Object.entries(textDict).filter(
      ([, v]) => typeof v === "string"
    ) as [string, string][];
    if (entries.length === 0) {
      throw new OcrServiceResponseError("Sidecar region text dict is empty");
    }

    const langidEntry = entries.find(([key, value]) => LANGID_KEY.test(key) && value.trim());
    const fallbackEntry = entries.find(([, value]) => value.trim());
    const chosen = langidEntry ?? fallbackEntry;

    // Empty/whitespace text in every key: not text, drop the region.
    if (!chosen) continue;
    // Degenerate box: drop.
    if (maxX <= minX || maxY <= minY) continue;

    const colors = extractTextColors("text_color" in entry ? entry.text_color : undefined);

    regions.push({
      minX,
      minY,
      maxX,
      maxY,
      ocrText: chosen[1].trim(),
      sourceLanguage: langidEntry ? langidEntry[0] : null,
      confidence: "prob" in entry ? asFiniteNumber(entry.prob) : null,
      angle: "angle" in entry ? asFiniteNumber(entry.angle) : null,
      cropBase64: extractCropBase64("background" in entry ? entry.background : undefined),
      textColorFg: colors.fg,
      textColorBg: colors.bg,
    });
  }

  return regions;
}
