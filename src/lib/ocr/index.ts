export { isOcrEnabled, getOcrServiceUrl, getOcrTimeoutMs, OCR_PIPELINE_CONFIG } from "./config";
export { parseSidecarResponse } from "./parse";
export { normalizeRegions } from "./normalize";
export { OcrServiceUnavailableError, OcrServiceResponseError } from "./errors";
export type {
  SidecarTranslation,
  SidecarResponse,
  ParsedRegion,
  NormalizedRegion,
  OcrRegionDto,
} from "./types";
