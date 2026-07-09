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
  /** Text colors as `#rrggbb`, when the sidecar reports them. */
  textColorFg: string | null;
  textColorBg: string | null;
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
  textColorFg: string | null;
  textColorBg: string | null;
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
  textColorFg: string | null;
  textColorBg: string | null;
  /** Schema version of the stored page inpaint, for cache invalidation. */
  cropVersion: number;
}
