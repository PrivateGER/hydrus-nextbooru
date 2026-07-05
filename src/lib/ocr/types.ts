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

/** Downscaled full-page image sent to the LLM as visual translation context. */
export interface OcrContextImage {
  /** Encoded image bytes (JPEG). */
  data: Buffer;
  mimeType: string;
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
  /** Inpainted (text-removed) region crop, raw base64 with the data-URI prefix stripped. */
  cropBase64: string | null;
  /** Foreground/background text colors as `#rrggbb`, when the sidecar reports them. */
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
  cropBase64: string | null;
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
  /** Whether an inpainted crop was captured for this region. */
  hasCrop: boolean;
  textColorFg: string | null;
  textColorBg: string | null;
  /** Schema version of the stored crop, for cache invalidation. */
  cropVersion: number;
}
