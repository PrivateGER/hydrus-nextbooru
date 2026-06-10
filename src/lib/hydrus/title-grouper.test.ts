import { describe, it, expect } from 'vitest';
import { deriveTitleSourceId, extractTitleGroups } from './title-grouper';
import { createMockFileMetadata } from '@/test/mocks/fixtures/hydrus-metadata';

// The legacy 32-bit djb2 hash, kept here only to prove the new scheme avoids a
// real collision it would have produced. Mirrors the removed implementation.
function legacyDjb2(title: string): string {
  let hash = 5381;
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 33) ^ title.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function createMetadataWithTags(tags: string[]) {
  return createMockFileMetadata({
    tags: {
      'all known tags': {
        storage_tags: { '0': tags },
        display_tags: { '0': tags },
      },
    },
  });
}

describe('extractTitleGroups', () => {
  it('should extract from title: tags', () => {
    const metadata = createMetadataWithTags([
      'title:My Series Part 1',
      'artist:john',
    ]);

    const result = extractTitleGroups(metadata);

    expect(result).toHaveLength(1);
    expect(result[0].normalizedTitle).toBe('My Series');
    expect(result[0].position).toBe(1);
  });

  it('should prefer page: tag over title-derived position', () => {
    const metadata = createMetadataWithTags([
      'title:My Series Part 1',
      'page:5',
    ]);

    const result = extractTitleGroups(metadata);

    expect(result).toHaveLength(1);
    expect(result[0].position).toBe(5); // from page: tag, not 1 from title
  });

  it('should deduplicate groups by sourceId', () => {
    const metadata = createMetadataWithTags([
      'title:My Series Part 1',
      'title:My Series (1)', // Same base title
    ]);

    const result = extractTitleGroups(metadata);

    expect(result).toHaveLength(1);
  });

  it('should handle multiple different title groups', () => {
    const metadata = createMetadataWithTags([
      'title:Series A Part 1',
      'title:Series B Chapter 2',
    ]);

    const result = extractTitleGroups(metadata);

    expect(result).toHaveLength(2);
  });

  it('should handle missing metadata gracefully', () => {
    const metadata = createMockFileMetadata({
      tags: {},
    });

    const result = extractTitleGroups(metadata);

    expect(result).toHaveLength(0);
  });

  it('should skip invalid title groups', () => {
    const metadata = createMetadataWithTags([
      'title:AB', // Too short
      'title:123', // Numeric only
      'title:Valid Title',
    ]);

    const result = extractTitleGroups(metadata);

    expect(result).toHaveLength(1);
    expect(result[0].normalizedTitle).toBe('Valid Title');
  });

  it('uses the lowercased normalized title directly as sourceId', () => {
    const metadata = createMetadataWithTags(['title:My Cool Series Part 3']);

    const result = extractTitleGroups(metadata);

    expect(result).toHaveLength(1);
    expect(result[0].normalizedTitle).toBe('My Cool Series');
    // sourceId is the lowercased base title, not an opaque hash.
    expect(result[0].sourceId).toBe('my cool series');
  });

  it('maps titles differing only by case to the same group (case-insensitive)', () => {
    const lower = extractTitleGroups(createMetadataWithTags(['title:battle royale']));
    const upper = extractTitleGroups(createMetadataWithTags(['title:Battle Royale']));

    expect(lower[0].sourceId).toBe(upper[0].sourceId);
    expect(lower[0].sourceId).toBe('battle royale');
  });
});

describe('deriveTitleSourceId', () => {
  it('returns the lowercased title verbatim (collision-free)', () => {
    expect(deriveTitleSourceId('Some Long Series Title')).toBe('some long series title');
    expect(deriveTitleSourceId('ALREADY LOWER')).toBe('already lower');
  });

  it('gives distinct sourceIds for two titles that collided under the old djb2 hash', () => {
    // Real djb2 collision: both titles hash to the same 8-hex string under the
    // legacy scheme, which would have silently merged two unrelated series.
    const a = 'ruex grnvzph';
    const b = 'kjvs xlsasok';

    // Sanity: confirm the collision actually exists in the legacy scheme.
    expect(legacyDjb2(a)).toBe(legacyDjb2(b));

    // New scheme keeps them distinct.
    expect(deriveTitleSourceId(a)).not.toBe(deriveTitleSourceId(b));
    expect(deriveTitleSourceId(a)).toBe(a);
    expect(deriveTitleSourceId(b)).toBe(b);
  });

  it('produces distinct groups end-to-end for the colliding titles via extractTitleGroups', () => {
    // These titles contain no digits, so normalization leaves them intact and
    // they flow through to distinct groups (old hash would merge them).
    const ga = extractTitleGroups(createMetadataWithTags(['title:ruex grnvzph']));
    const gb = extractTitleGroups(createMetadataWithTags(['title:kjvs xlsasok']));

    expect(ga).toHaveLength(1);
    expect(gb).toHaveLength(1);
    expect(ga[0].sourceId).not.toBe(gb[0].sourceId);
  });
});
