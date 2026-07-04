import { OcrServiceResponseError } from "./errors";
import type { ParsedRegion } from "./types";

const LANGID_KEY = /^[a-z]{2}$/;

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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

    regions.push({
      minX,
      minY,
      maxX,
      maxY,
      ocrText: chosen[1].trim(),
      sourceLanguage: langidEntry ? langidEntry[0] : null,
      confidence: "prob" in entry ? asFiniteNumber(entry.prob) : null,
      angle: "angle" in entry ? asFiniteNumber(entry.angle) : null,
    });
  }

  return regions;
}
