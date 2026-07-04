/** One entry of the sidecar's TranslationResponse.translations array. */
export interface SidecarTranslation {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  angle?: number;
  prob?: number;
  /** lang-key -> text. Source key is a 2-letter langid code; target keys are MIT codes like "ENG". */
  text: Record<string, string>;
}

export interface SidecarResponse {
  translations: SidecarTranslation[];
}

/** Region in sidecar pixel space after text extraction. Array order = reading order. */
export interface ParsedRegion {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  ocrText: string;
  sourceLanguage: string | null;
  confidence: number | null;
  angle: number | null;
}

/** Region normalized to 0-1 against the uploaded image dimensions. */
export interface NormalizedRegion {
  readingOrder: number;
  x: number;
  y: number;
  width: number;
  height: number;
  ocrText: string;
  sourceLanguage: string | null;
  confidence: number | null;
  angle: number | null;
}

/** API/UI shape of a persisted region. */
export interface OcrRegionDto {
  readingOrder: number;
  x: number;
  y: number;
  width: number;
  height: number;
  ocrText: string;
  translatedText: string | null;
  sourceLanguage: string | null;
}
