import { describe, it, expect } from 'vitest';
import {
  parseTag,
  parseTags,
  normalizeTagForStorage,
} from './tag-mapper';
import { TagCategory } from '@/generated/prisma/client';

describe('parseTag', () => {
  describe('tags without namespace', () => {
    it('should parse tag without namespace as GENERAL', () => {
      const result = parseTag('blue eyes');

      expect(result.namespace).toBeNull();
      expect(result.name).toBe('blue eyes');
      expect(result.category).toBe(TagCategory.GENERAL);
      expect(result.originalTag).toBe('blue eyes');
    });

    it('should trim whitespace', () => {
      const result = parseTag('  blue eyes  ');

      expect(result.name).toBe('blue eyes');
    });
  });

  describe('artist namespaces', () => {
    it('should parse artist namespace', () => {
      const result = parseTag('artist:john doe');

      expect(result.namespace).toBe('artist');
      expect(result.name).toBe('john doe');
      expect(result.category).toBe(TagCategory.ARTIST);
    });

    it('should handle creator as artist alias', () => {
      const result = parseTag('creator:jane smith');

      expect(result.namespace).toBe('creator');
      expect(result.name).toBe('jane smith');
      expect(result.category).toBe(TagCategory.ARTIST);
    });

    it('should handle drawn_by as artist alias', () => {
      const result = parseTag('drawn_by:some artist');

      expect(result.namespace).toBe('drawn_by');
      expect(result.name).toBe('some artist');
      expect(result.category).toBe(TagCategory.ARTIST);
    });
  });

  describe('character namespaces', () => {
    it('should parse character namespace', () => {
      const result = parseTag('character:alice');

      expect(result.namespace).toBe('character');
      expect(result.name).toBe('alice');
      expect(result.category).toBe(TagCategory.CHARACTER);
    });

    it('should handle char as character alias', () => {
      const result = parseTag('char:bob');

      expect(result.namespace).toBe('char');
      expect(result.name).toBe('bob');
      expect(result.category).toBe(TagCategory.CHARACTER);
    });

    it('should handle person as character alias', () => {
      const result = parseTag('person:real person name');

      expect(result.namespace).toBe('person');
      expect(result.name).toBe('real person name');
      expect(result.category).toBe(TagCategory.CHARACTER);
    });
  });

  describe('copyright namespaces', () => {
    it('should parse series as copyright', () => {
      const result = parseTag('series:wonderland');

      expect(result.namespace).toBe('series');
      expect(result.name).toBe('wonderland');
      expect(result.category).toBe(TagCategory.COPYRIGHT);
    });

    it('should handle copyright namespace', () => {
      const result = parseTag('copyright:some franchise');

      expect(result.namespace).toBe('copyright');
      expect(result.name).toBe('some franchise');
      expect(result.category).toBe(TagCategory.COPYRIGHT);
    });

    it('should handle parody as copyright', () => {
      const result = parseTag('parody:original work');

      expect(result.namespace).toBe('parody');
      expect(result.name).toBe('original work');
      expect(result.category).toBe(TagCategory.COPYRIGHT);
    });

    it('should handle franchise as copyright', () => {
      const result = parseTag('franchise:big franchise');

      expect(result.namespace).toBe('franchise');
      expect(result.name).toBe('big franchise');
      expect(result.category).toBe(TagCategory.COPYRIGHT);
    });
  });

  describe('meta namespaces', () => {
    it('should parse meta namespace', () => {
      const result = parseTag('meta:high resolution');

      expect(result.namespace).toBe('meta');
      expect(result.name).toBe('high resolution');
      expect(result.category).toBe(TagCategory.META);
    });

    it('should handle medium as meta', () => {
      const result = parseTag('medium:digital');

      expect(result.namespace).toBe('medium');
      expect(result.name).toBe('digital');
      expect(result.category).toBe(TagCategory.META);
    });

    it('should handle rating as meta', () => {
      const result = parseTag('rating:safe');

      expect(result.namespace).toBe('rating');
      expect(result.name).toBe('safe');
      expect(result.category).toBe(TagCategory.META);
    });

    it('should handle source as meta', () => {
      const result = parseTag('source:pixiv');

      expect(result.namespace).toBe('source');
      expect(result.name).toBe('pixiv');
      expect(result.category).toBe(TagCategory.META);
    });
  });

  describe('unknown namespaces', () => {
    it('should treat unknown namespaces as general', () => {
      const result = parseTag('clothing:dress');

      expect(result.namespace).toBe('clothing');
      expect(result.name).toBe('dress');
      expect(result.category).toBe(TagCategory.GENERAL);
    });

    it('should handle sub-namespaces as general', () => {
      const result = parseTag('body:arms:raised');

      // First colon splits namespace
      expect(result.namespace).toBe('body');
      expect(result.name).toBe('arms:raised');
      expect(result.category).toBe(TagCategory.GENERAL);
    });
  });

  describe('case insensitivity', () => {
    it('should normalize namespace to lowercase', () => {
      const result = parseTag('ARTIST:John Doe');

      expect(result.namespace).toBe('artist');
      expect(result.name).toBe('John Doe');
      expect(result.category).toBe(TagCategory.ARTIST);
    });

    it('should preserve name case', () => {
      const result = parseTag('character:Alice In Wonderland');

      expect(result.name).toBe('Alice In Wonderland');
    });
  });

  describe('edge cases', () => {
    it('should handle colons in tag name', () => {
      const result = parseTag('artist:name:with:colons');

      expect(result.namespace).toBe('artist');
      expect(result.name).toBe('name:with:colons');
    });

    it('should handle empty namespace', () => {
      const result = parseTag(':empty namespace');

      expect(result.namespace).toBe('');
      expect(result.name).toBe('empty namespace');
      expect(result.category).toBe(TagCategory.GENERAL);
    });

    it('should handle empty name', () => {
      const result = parseTag('artist:');

      expect(result.namespace).toBe('artist');
      expect(result.name).toBe('');
    });
  });
});

describe('parseTags', () => {
  it('should parse multiple tags', () => {
    const result = parseTags(['blue eyes', 'artist:john', 'character:alice']);

    expect(result).toHaveLength(3);
    expect(result[0].category).toBe(TagCategory.GENERAL);
    expect(result[1].category).toBe(TagCategory.ARTIST);
    expect(result[2].category).toBe(TagCategory.CHARACTER);
  });

  it('should handle empty array', () => {
    const result = parseTags([]);

    expect(result).toHaveLength(0);
  });
});

describe('normalizeTagForStorage', () => {
  it('should strip namespace for artist tags', () => {
    const tag = parseTag('artist:john doe');
    const result = normalizeTagForStorage(tag);

    expect(result.name).toBe('john doe');
    expect(result.category).toBe(TagCategory.ARTIST);
  });

  it('should strip namespace for character tags', () => {
    const tag = parseTag('character:alice');
    const result = normalizeTagForStorage(tag);

    expect(result.name).toBe('alice');
    expect(result.category).toBe(TagCategory.CHARACTER);
  });

  it('should strip namespace for copyright tags', () => {
    const tag = parseTag('series:wonderland');
    const result = normalizeTagForStorage(tag);

    expect(result.name).toBe('wonderland');
    expect(result.category).toBe(TagCategory.COPYRIGHT);
  });

  it('should preserve full tag for general tags with namespaces', () => {
    const tag = parseTag('clothing:dress');
    const result = normalizeTagForStorage(tag);

    expect(result.name).toBe('clothing:dress');
    expect(result.category).toBe(TagCategory.GENERAL);
  });

  it('should preserve full tag for general tags without namespaces', () => {
    const tag = parseTag('blue eyes');
    const result = normalizeTagForStorage(tag);

    expect(result.name).toBe('blue eyes');
    expect(result.category).toBe(TagCategory.GENERAL);
  });
});
