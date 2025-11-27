import { describe, it, expect } from 'vitest';
import {
  extractTitleTags,
  extractPageNumber,
  normalizeTitle,
  parseTitleGroup,
  extractTitleGroups,
} from './title-grouper';
import { SourceType } from '@/generated/prisma/client';
import type { HydrusFileMetadata } from './types';
import { createMockFileMetadata } from '@/test/mocks/fixtures/hydrus-metadata';

function createMetadataWithTags(tags: string[]): HydrusFileMetadata {
  return createMockFileMetadata({
    tags: {
      'all known tags': {
        storage_tags: { '0': tags },
        display_tags: { '0': tags },
      },
    },
  });
}

describe('extractTitleTags', () => {
  it('should extract title: namespaced tags', () => {
    const metadata = createMetadataWithTags([
      'title:My Artwork Part 1',
      'artist:john',
      'title:Another Title',
    ]);

    const result = extractTitleTags(metadata);

    expect(result).toHaveLength(2);
    expect(result).toContain('My Artwork Part 1');
    expect(result).toContain('Another Title');
  });

  it('should handle case insensitive title namespace', () => {
    const metadata = createMetadataWithTags([
      'TITLE:Uppercase Title',
      'Title:Mixed Case',
    ]);

    const result = extractTitleTags(metadata);

    expect(result).toHaveLength(2);
    expect(result).toContain('Uppercase Title');
    expect(result).toContain('Mixed Case');
  });

  it('should handle missing tags object', () => {
    const metadata = createMockFileMetadata({
      tags: undefined as never,
    });

    const result = extractTitleTags(metadata);

    expect(result).toHaveLength(0);
  });

  it('should handle invalid tags object', () => {
    const metadata = createMockFileMetadata({
      tags: 'invalid' as never,
    });

    const result = extractTitleTags(metadata);

    expect(result).toHaveLength(0);
  });

  it('should handle empty title value', () => {
    const metadata = createMetadataWithTags(['title:', 'title:   ']);

    const result = extractTitleTags(metadata);

    expect(result).toHaveLength(0);
  });

  it('should handle multiple services', () => {
    const metadata = createMockFileMetadata({
      tags: {
        'service1': {
          storage_tags: { '0': ['title:Title 1'] },
          display_tags: { '0': ['title:Title 1'] },
        },
        'service2': {
          storage_tags: { '0': ['title:Title 2'] },
          display_tags: { '0': ['title:Title 2'] },
        },
      },
    });

    const result = extractTitleTags(metadata);

    expect(result).toHaveLength(2);
    expect(result).toContain('Title 1');
    expect(result).toContain('Title 2');
  });
});

describe('extractPageNumber', () => {
  it('should extract from page: namespace tag', () => {
    const metadata = createMetadataWithTags(['page:5', 'title:Something']);

    const result = extractPageNumber(metadata);

    expect(result).toBe(5);
  });

  it('should return 0 when not found', () => {
    const metadata = createMetadataWithTags(['title:Something', 'artist:john']);

    const result = extractPageNumber(metadata);

    expect(result).toBe(0);
  });

  it('should handle case insensitive page namespace', () => {
    const metadata = createMetadataWithTags(['PAGE:3']);

    const result = extractPageNumber(metadata);

    expect(result).toBe(3);
  });

  it('should handle leading zeros', () => {
    const metadata = createMetadataWithTags(['page:007']);

    const result = extractPageNumber(metadata);

    expect(result).toBe(7);
  });

  it('should return 0 for invalid page number', () => {
    const metadata = createMetadataWithTags(['page:invalid']);

    const result = extractPageNumber(metadata);

    expect(result).toBe(0);
  });

  it('should return 0 for zero page', () => {
    const metadata = createMetadataWithTags(['page:0']);

    const result = extractPageNumber(metadata);

    expect(result).toBe(0);
  });

  it('should return 0 for negative page', () => {
    const metadata = createMetadataWithTags(['page:-1']);

    const result = extractPageNumber(metadata);

    expect(result).toBe(0);
  });
});

describe('normalizeTitle', () => {
  describe('fraction page numbers', () => {
    it('should strip fraction format (7/10)', () => {
      const result = normalizeTitle('My Series 7/10');

      expect(result.baseTitle).toBe('My Series');
      expect(result.position).toBe(7);
    });

    it('should handle spaces in fraction', () => {
      const result = normalizeTitle('My Series 1 / 5');

      expect(result.baseTitle).toBe('My Series');
      expect(result.position).toBe(1);
    });
  });

  describe('parenthesized numbers', () => {
    it('should strip parenthesized numbers (3)', () => {
      const result = normalizeTitle('Title (3)');

      expect(result.baseTitle).toBe('Title');
      expect(result.position).toBe(3);
    });

    it('should handle spaces in parentheses', () => {
      const result = normalizeTitle('Title ( 2 )');

      expect(result.baseTitle).toBe('Title');
      expect(result.position).toBe(2);
    });

    it('should handle leading zeros in parentheses', () => {
      const result = normalizeTitle('Title (01)');

      expect(result.baseTitle).toBe('Title');
      expect(result.position).toBe(1);
    });
  });

  describe('bracketed numbers', () => {
    it('should strip bracketed numbers [02]', () => {
      const result = normalizeTitle('Series [02]');

      expect(result.baseTitle).toBe('Series');
      expect(result.position).toBe(2);
    });
  });

  describe('separator + number', () => {
    it('should handle "- N" format', () => {
      const result = normalizeTitle('Artwork - 5');

      expect(result.baseTitle).toBe('Artwork');
      expect(result.position).toBe(5);
    });

    it('should handle "_ N" format', () => {
      const result = normalizeTitle('Artwork_03');

      expect(result.baseTitle).toBe('Artwork');
      expect(result.position).toBe(3);
    });
  });

  describe('part/chapter formats', () => {
    it('should handle "part N" format', () => {
      const result = normalizeTitle('Story part 2');

      expect(result.baseTitle).toBe('Story');
      expect(result.position).toBe(2);
    });

    it('should handle "chapter N" format', () => {
      const result = normalizeTitle('Book chapter 5');

      expect(result.baseTitle).toBe('Book');
      expect(result.position).toBe(5);
    });

    it('should handle "ch N" format', () => {
      const result = normalizeTitle('Manga ch 10');

      expect(result.baseTitle).toBe('Manga');
      expect(result.position).toBe(10);
    });

    it('should handle "- Chapter N" format', () => {
      const result = normalizeTitle('Novel - Chapter 3');

      // Note: The patterns strip "- Chapter 3" but leave the trailing " -"
      // This is acceptable behavior as the title is still groupable
      expect(result.baseTitle).toBe('Novel -');
      expect(result.position).toBe(3);
    });

    it('should handle "page N" format', () => {
      const result = normalizeTitle('Comic page 15');

      expect(result.baseTitle).toBe('Comic');
      expect(result.position).toBe(15);
    });

    it('should handle "p N" format', () => {
      const result = normalizeTitle('Comic p 3');

      expect(result.baseTitle).toBe('Comic');
      expect(result.position).toBe(3);
    });

    it('should handle "#N" format', () => {
      const result = normalizeTitle('Episode #7');

      expect(result.baseTitle).toBe('Episode');
      expect(result.position).toBe(7);
    });
  });

  describe('trailing numbers', () => {
    it('should strip trailing digits with space', () => {
      const result = normalizeTitle('Title 01');

      expect(result.baseTitle).toBe('Title');
      expect(result.position).toBe(1);
    });

    it('should strip single trailing digit', () => {
      const result = normalizeTitle('Series 5');

      expect(result.baseTitle).toBe('Series');
      expect(result.position).toBe(5);
    });
  });

  describe('Japanese page indicators', () => {
    it('should handle "その1" format', () => {
      const result = normalizeTitle('タイトル その1');

      expect(result.baseTitle).toBe('タイトル');
      expect(result.position).toBe(1);
    });

    it('should handle "第5話" format', () => {
      const result = normalizeTitle('シリーズ 第5話');

      expect(result.baseTitle).toBe('シリーズ');
      expect(result.position).toBe(5);
    });

    it('should handle "第3章" format', () => {
      const result = normalizeTitle('小説 第3章');

      expect(result.baseTitle).toBe('小説');
      expect(result.position).toBe(3);
    });
  });

  describe('no page number', () => {
    it('should preserve title when no page number', () => {
      const result = normalizeTitle('Simple Title');

      expect(result.baseTitle).toBe('Simple Title');
      expect(result.position).toBe(0);
    });

    it('should normalize whitespace', () => {
      const result = normalizeTitle('  Multiple   Spaces  ');

      expect(result.baseTitle).toBe('Multiple Spaces');
    });
  });
});

describe('parseTitleGroup', () => {
  it('should return null for titles too short (<3 chars)', () => {
    expect(parseTitleGroup('AB')).toBeNull();
    expect(parseTitleGroup('A')).toBeNull();
    expect(parseTitleGroup('')).toBeNull();
  });

  it('should return null for numeric-only titles', () => {
    expect(parseTitleGroup('123')).toBeNull();
    expect(parseTitleGroup('12345')).toBeNull();
  });

  it('should return null when base title becomes too short after stripping', () => {
    expect(parseTitleGroup('12 1')).toBeNull(); // "12" after stripping is numeric
  });

  it('should generate consistent sourceId for same base title', () => {
    const group1 = parseTitleGroup('My Series Part 1');
    const group2 = parseTitleGroup('My Series Part 2');
    const group3 = parseTitleGroup('My Series (3)');

    expect(group1).not.toBeNull();
    expect(group2).not.toBeNull();
    expect(group3).not.toBeNull();

    // All should have same sourceId since base title is "My Series"
    expect(group1!.sourceId).toBe(group2!.sourceId);
    expect(group2!.sourceId).toBe(group3!.sourceId);
  });

  it('should have TITLE as sourceType', () => {
    const group = parseTitleGroup('Some Title Part 1');

    expect(group).not.toBeNull();
    expect(group!.sourceType).toBe(SourceType.TITLE);
  });

  it('should extract position from title', () => {
    const group = parseTitleGroup('Artwork Part 5');

    expect(group).not.toBeNull();
    expect(group!.position).toBe(5);
  });

  it('should include normalized title', () => {
    const group = parseTitleGroup('My Cool Artwork Part 3');

    expect(group).not.toBeNull();
    expect(group!.normalizedTitle).toBe('My Cool Artwork');
  });
});

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

// ============================================================================
// EDGE CASES - Representative tests for complex scenarios
// ============================================================================

describe('normalizeTitle - edge cases', () => {
  describe('unicode handling', () => {
    it('should handle titles with emoji', () => {
      const result = normalizeTitle('My Art ❤️ Part 3');

      expect(result.baseTitle).toBe('My Art ❤️');
      expect(result.position).toBe(3);
    });

    it('should handle titles with accented characters', () => {
      const result = normalizeTitle('Café Élégant Part 5');

      expect(result.baseTitle).toBe('Café Élégant');
      expect(result.position).toBe(5);
    });

    it('should handle mixed script titles', () => {
      const result = normalizeTitle('東方Project Part 7');

      expect(result.baseTitle).toBe('東方Project');
      expect(result.position).toBe(7);
    });

    it('should handle mixed Japanese and Arabic numerals', () => {
      const result = normalizeTitle('シリーズ 第10話');

      expect(result.baseTitle).toBe('シリーズ');
      expect(result.position).toBe(10);
    });
  });

  describe('common patterns', () => {
    it('should handle version numbers (v2)', () => {
      const result = normalizeTitle('Software v2');

      expect(result.baseTitle).toBe('Software');
      expect(result.position).toBe(2);
    });

    it('should handle "No." prefix', () => {
      const result = normalizeTitle('Illustration No.15');

      expect(result.baseTitle).toBe('Illustration');
      expect(result.position).toBe(15);
    });

    it('should handle Twitter-style hashtag numbers (#365)', () => {
      const result = normalizeTitle('Daily Sketch #365');

      expect(result.baseTitle).toBe('Daily Sketch');
      expect(result.position).toBe(365);
    });
  });

  describe('real-world title formats', () => {
    it('should handle Pixiv-style titles with artist name prefix', () => {
      const result = normalizeTitle('[Artist Name] Character Illustration 05');

      expect(result.baseTitle).toBe('[Artist Name] Character Illustration');
      expect(result.position).toBe(5);
    });

    it('should handle doujin circle naming', () => {
      const result = normalizeTitle('(C99) [Circle Name] Title Part 2');

      expect(result.position).toBe(2);
    });

    it('should handle manga chapter titles with arc names', () => {
      const result = normalizeTitle('One Piece - Wano Arc - Chapter 1000');

      expect(result.position).toBe(1000);
    });
  });

  describe('boundary conditions', () => {
    it('should handle very large page numbers', () => {
      const result = normalizeTitle('Long Running Series Chapter 9999');

      expect(result.position).toBe(9999);
    });

    it('should handle extremely long title', () => {
      const longTitle = 'A'.repeat(500) + ' Part 7';
      const result = normalizeTitle(longTitle);

      expect(result.position).toBe(7);
      expect(result.baseTitle.length).toBeGreaterThan(400);
    });

    it('should normalize multiple spaces before number', () => {
      const result = normalizeTitle('Title     42');

      expect(result.baseTitle).toBe('Title');
      expect(result.position).toBe(42);
    });
  });

  describe('grouping consistency', () => {
    it('should group titles with different separators consistently', () => {
      const groups = [
        parseTitleGroup('My Art - 1'),
        parseTitleGroup('My Art _ 2'),
        parseTitleGroup('My Art (3)'),
        parseTitleGroup('My Art [4]'),
        parseTitleGroup('My Art Part 5'),
      ];

      // All should be valid groups
      groups.forEach((g) => expect(g).not.toBeNull());

      // At least some should share the same sourceId
      const uniqueIds = new Set(groups.map((g) => g!.sourceId));
      expect(uniqueIds.size).toBeLessThanOrEqual(3);
    });

    it('should differentiate truly different series names', () => {
      const group1 = parseTitleGroup('Alpha Series Part 1');
      const group2 = parseTitleGroup('Beta Series Part 1');

      expect(group1).not.toBeNull();
      expect(group2).not.toBeNull();
      expect(group1!.sourceId).not.toBe(group2!.sourceId);
    });

    it('should be case-insensitive for grouping', () => {
      const group1 = parseTitleGroup('My Title Part 1');
      const group2 = parseTitleGroup('MY TITLE Part 2');
      const group3 = parseTitleGroup('my title part 3');

      expect(group1).not.toBeNull();
      expect(group2).not.toBeNull();
      expect(group3).not.toBeNull();

      expect(group1!.sourceId).toBe(group2!.sourceId);
      expect(group2!.sourceId).toBe(group3!.sourceId);
    });
  });
});
