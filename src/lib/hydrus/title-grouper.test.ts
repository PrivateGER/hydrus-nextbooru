import { describe, it, expect } from 'vitest';
import { extractTitleGroups } from './title-grouper';
import { createMockFileMetadata } from '@/test/mocks/fixtures/hydrus-metadata';

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
});
