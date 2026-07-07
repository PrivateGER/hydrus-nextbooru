export { isOcrEnabled, getOcrServiceUrl, getOcrTimeoutMs, OCR_PIPELINE_CONFIG } from "./config";
export { parseSidecarResponse } from "./parse";
export { normalizeRegions } from "./normalize";
export { OcrServiceUnavailableError, OcrServiceResponseError } from "./errors";
export { renderInpaintedPage, scanImage, checkOcrServiceHealth } from "./client";
export {
  scanPost,
  ocrPost,
  translateRegions,
  persistScan,
  markScanFailed,
  finalizeScan,
  renderPostInpaintedPage,
  OcrFileMissingError,
  type ScannablePost,
  type ScanPostOutcome,
} from "./scan-post";
export type {
  SidecarTranslation,
  SidecarResponse,
  ParsedRegion,
  NormalizedRegion,
  OcrRegionDto,
} from "./types";
export {
  acquireOcrBatchLock,
  requestOcrBatchCancel,
  requestOcrBatchReset,
  selectOcrBatchPosts,
  runOcrBatch,
  getOcrAdminStatus,
  type OcrBatchOptions,
  type OcrBatchResult,
} from "./batch";
export { storeInpaintedPage, deleteCrops, deleteInpaintedPage, buildInpaintedPageFilePath } from "./crops";
