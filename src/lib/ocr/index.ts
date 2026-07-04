export { isOcrEnabled, getOcrServiceUrl, getOcrTimeoutMs, OCR_PIPELINE_CONFIG } from "./config";
export { parseSidecarResponse } from "./parse";
export { normalizeRegions } from "./normalize";
export { OcrServiceUnavailableError, OcrServiceResponseError } from "./errors";
export { scanImage, checkOcrServiceHealth } from "./client";
export type {
  SidecarTranslation,
  SidecarResponse,
  ParsedRegion,
  NormalizedRegion,
  OcrRegionDto,
} from "./types";
