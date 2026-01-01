// Hydrus Client API Types
// Based on: https://hydrusnetwork.github.io/hydrus/developer_api.html

export interface HydrusApiResponse {
  version: number;
  hydrus_version: number;
}

export interface HydrusSearchResponse extends HydrusApiResponse {
  file_ids: number[];
  hashes?: string[];
}

export interface HydrusFileMetadata {
  file_id: number;
  hash: string;
  size: number;
  mime: string;
  filetype_human: string;
  filetype_enum: number;
  ext: string;
  width: number | null;
  height: number | null;
  thumbnail_width?: number;
  thumbnail_height?: number;
  duration: number | null; // milliseconds
  time_modified: number | null;
  has_audio: boolean | null;
  blurhash: string | null;
  pixel_hash: string | null;
  num_frames: number | null;
  num_words: number | null;
  is_inbox: boolean;
  is_local: boolean;
  is_trashed: boolean;
  is_deleted: boolean;
  has_exif: boolean;
  has_transparency: boolean;
  known_urls: string[];
  ratings: Record<string, boolean | number | null>;
  tags: Record<string, HydrusTagServiceTags>;
  file_services: {
    current: Record<string, { time_imported: number }>;
    deleted: Record<string, { time_deleted: number; time_imported: number }>;
  };
  notes?: Record<string, string>; // Note name -> note content (when include_notes=true)
}

export interface HydrusTagServiceTags {
  storage_tags: Record<string, string[]>; // status -> tags
  display_tags: Record<string, string[]>; // status -> tags
}

export interface HydrusMetadataResponse extends HydrusApiResponse {
  metadata: HydrusFileMetadata[];
  services?: HydrusServicesObject;
}

export interface HydrusService {
  name: string;
  type: number;
  type_pretty: string;
  star_shape?: string;
  min_stars?: number;
  max_stars?: number;
}

export interface HydrusServicesObject {
  [serviceKey: string]: HydrusService;
}

export interface HydrusServicesResponse extends HydrusApiResponse {
  services: HydrusServicesObject;
}

export interface HydrusFilePathResponse extends HydrusApiResponse {
  path: string;
  filetype?: string;
  size?: number;
}

export interface HydrusThumbnailPathResponse extends HydrusApiResponse {
  path: string;
  filetype?: string;
}

export interface HydrusVerifyAccessKeyResponse extends HydrusApiResponse {
  name: string;
  permits_everything: boolean;
  basic_permissions: number[];
  human_description: string;
}

// File sort types
export enum HydrusFileSortType {
  FileSize = 0,
  Duration = 1,
  ImportTime = 2,
  FileType = 3,
  Random = 4,
  Width = 5,
  Height = 6,
  Ratio = 7,
  NumPixels = 8,
  NumTags = 9,
  MediaViews = 10,
  MediaViewtime = 11,
  Bitrate = 12,
  HasAudio = 13,
  ModifiedTime = 14,
  Framerate = 15,
  NumFrames = 16,
  LastViewedTime = 18,
  ArchiveTimestamp = 19,
  Hash = 20,
}
