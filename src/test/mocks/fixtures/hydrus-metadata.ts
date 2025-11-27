import type { HydrusFileMetadata, HydrusSearchResponse, HydrusMetadataResponse } from '@/lib/hydrus/types';

/**
 * Create a mock HydrusFileMetadata object with sensible defaults.
 * Override any field by passing it in the overrides parameter.
 */
export function createMockFileMetadata(
  overrides: Partial<HydrusFileMetadata> = {}
): HydrusFileMetadata {
  const hash = overrides.hash ?? 'a'.repeat(64);

  return {
    file_id: 1,
    hash,
    size: 1024,
    mime: 'image/png',
    filetype_human: 'png',
    filetype_enum: 1,
    ext: '.png',
    width: 800,
    height: 600,
    thumbnail_width: 150,
    thumbnail_height: 113,
    duration: null,
    time_modified: null,
    has_audio: false,
    blurhash: 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH',
    pixel_hash: null,
    num_frames: null,
    num_words: null,
    is_inbox: false,
    is_local: true,
    is_trashed: false,
    is_deleted: false,
    has_exif: false,
    has_transparency: false,
    known_urls: [],
    ratings: {},
    tags: {
      'all known tags': {
        storage_tags: { '0': ['tag1', 'artist:test artist'] },
        display_tags: { '0': ['tag1', 'artist:test artist'] },
      },
    },
    file_services: {
      current: {
        'local files': { time_imported: Math.floor(Date.now() / 1000) },
      },
      deleted: {},
    },
    ...overrides,
  };
}

/**
 * Create a batch of mock file metadata for testing concurrent processing.
 */
export function createMockFileBatch(count: number, baseOverrides: Partial<HydrusFileMetadata> = {}): HydrusFileMetadata[] {
  return Array.from({ length: count }, (_, i) =>
    createMockFileMetadata({
      ...baseOverrides,
      file_id: i + 1,
      hash: `${'a'.repeat(62)}${String(i).padStart(2, '0')}`,
    })
  );
}

/**
 * Create a mock file with specific tags for testing tag extraction.
 */
export function createMockFileWithTags(tags: string[], overrides: Partial<HydrusFileMetadata> = {}): HydrusFileMetadata {
  return createMockFileMetadata({
    ...overrides,
    tags: {
      'all known tags': {
        storage_tags: { '0': tags },
        display_tags: { '0': tags },
      },
    },
  });
}

/**
 * Create a mock file with specific URLs for testing URL parsing.
 */
export function createMockFileWithUrls(urls: string[], overrides: Partial<HydrusFileMetadata> = {}): HydrusFileMetadata {
  return createMockFileMetadata({
    ...overrides,
    known_urls: urls,
  });
}

/**
 * Create a mock file with notes for testing note syncing.
 */
export function createMockFileWithNotes(
  notes: Record<string, string>,
  overrides: Partial<HydrusFileMetadata> = {}
): HydrusFileMetadata {
  return createMockFileMetadata({
    ...overrides,
    notes,
  });
}

/**
 * Create a mock search response.
 */
export function createMockSearchResponse(fileIds: number[]): HydrusSearchResponse {
  return {
    version: 1,
    hydrus_version: 575,
    file_ids: fileIds,
    hashes: fileIds.map((id) => `${'a'.repeat(62)}${String(id).padStart(2, '0')}`),
  };
}

/**
 * Create a mock metadata response.
 */
export function createMockMetadataResponse(metadata: HydrusFileMetadata[]): HydrusMetadataResponse {
  return {
    version: 1,
    hydrus_version: 575,
    metadata,
  };
}

// Common test fixtures

/** File with multiple tag categories */
export const fileWithVariousTags = createMockFileWithTags([
  'tag1',
  'tag2',
  'artist:john doe',
  'character:alice',
  'series:wonderland',
  'creator:another artist',
  'meta:high resolution',
]);

/** File with Pixiv URL */
export const fileWithPixivUrl = createMockFileWithUrls([
  'https://www.pixiv.net/en/artworks/12345678',
  'https://i.pximg.net/img-original/img/2023/01/01/12/00/00/12345678_p0.png',
]);

/** File with Twitter URL */
export const fileWithTwitterUrl = createMockFileWithUrls([
  'https://twitter.com/username/status/1234567890123456789',
  'https://pbs.twimg.com/media/AbCdEfGhIjK.jpg',
]);

/** File with multiple source URLs */
export const fileWithMultipleSources = createMockFileWithUrls([
  'https://www.pixiv.net/en/artworks/12345678',
  'https://twitter.com/username/status/1234567890123456789',
  'https://danbooru.donmai.us/posts/1234567',
]);

/** Video file */
export const videoFile = createMockFileMetadata({
  file_id: 100,
  hash: 'b'.repeat(64),
  mime: 'video/mp4',
  ext: '.mp4',
  width: 1920,
  height: 1080,
  duration: 30000, // 30 seconds
  has_audio: true,
  num_frames: 900,
});

/** File with no tags */
export const fileWithNoTags = createMockFileMetadata({
  file_id: 200,
  hash: 'c'.repeat(64),
  tags: {},
});

/** File with malformed tags (for defensive parsing tests) */
export const fileWithMalformedTags = createMockFileMetadata({
  file_id: 300,
  hash: 'd'.repeat(64),
  tags: {
    'all known tags': {
      storage_tags: { '0': ['valid tag', '', null as unknown as string, 123 as unknown as string] },
      display_tags: { '0': ['valid tag', '', null as unknown as string, 123 as unknown as string] },
    },
  },
});
