export { HydrusClient, HydrusApiError, getHydrusClient } from "./client";
export type { HydrusClientConfig } from "./client";

export * from "./types";

export {
  parseTag,
  parseTags,
  normalizeTagForStorage,
} from "./tag-mapper";
export type { ParsedTag } from "./tag-mapper";

export {
  parseSourceUrl,
  parseSourceUrls,
  getCanonicalSourceUrl,
} from "./url-parser";
export type { ParsedSourceUrl } from "./url-parser";

export { syncFromHydrus, getSyncState } from "./sync";
export type { SyncProgress, SyncOptions } from "./sync";
