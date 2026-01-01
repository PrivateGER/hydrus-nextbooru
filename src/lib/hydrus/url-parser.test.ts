import { describe, it, expect } from 'vitest';
import {
  parseSourceUrl,
  parseSourceUrls,
  getCanonicalSourceUrl,
} from './url-parser';
import { SourceType } from '@/generated/prisma/client';

describe('parseSourceUrl', () => {
  describe('Pixiv URLs', () => {
    it('should parse standard artworks URL', () => {
      const result = parseSourceUrl('https://www.pixiv.net/artworks/12345678');

      expect(result).not.toBeNull();
      expect(result!.sourceType).toBe(SourceType.PIXIV);
      expect(result!.sourceId).toBe('12345678');
    });

    it('should parse English artworks URL', () => {
      const result = parseSourceUrl('https://www.pixiv.net/en/artworks/12345678');

      expect(result).not.toBeNull();
      expect(result!.sourceType).toBe(SourceType.PIXIV);
      expect(result!.sourceId).toBe('12345678');
    });

    it('should parse legacy member_illust URL', () => {
      const result = parseSourceUrl(
        'https://www.pixiv.net/member_illust.php?mode=medium&illust_id=12345678'
      );

      expect(result).not.toBeNull();
      expect(result!.sourceType).toBe(SourceType.PIXIV);
      expect(result!.sourceId).toBe('12345678');
    });

    it('should parse pximg CDN URL', () => {
      const result = parseSourceUrl(
        'https://i.pximg.net/img-original/img/2023/01/01/12/00/00/12345678_p0.png'
      );

      expect(result).not.toBeNull();
      expect(result!.sourceType).toBe(SourceType.PIXIV);
      expect(result!.sourceId).toBe('12345678');
    });

    it('should parse pximg URL with multiple pages', () => {
      const result = parseSourceUrl(
        'https://i.pximg.net/img-original/img/2023/01/01/12/00/00/12345678_p5.jpg'
      );

      expect(result).not.toBeNull();
      expect(result!.sourceType).toBe(SourceType.PIXIV);
      expect(result!.sourceId).toBe('12345678');
    });
  });

  describe('Twitter URLs', () => {
    it('should parse twitter.com status URL', () => {
      const result = parseSourceUrl(
        'https://twitter.com/username/status/1234567890123456789'
      );

      expect(result).not.toBeNull();
      expect(result!.sourceType).toBe(SourceType.TWITTER);
      expect(result!.sourceId).toBe('1234567890123456789');
    });

    it('should parse x.com URL', () => {
      const result = parseSourceUrl(
        'https://x.com/username/status/1234567890123456789'
      );

      expect(result).not.toBeNull();
      expect(result!.sourceType).toBe(SourceType.TWITTER);
      expect(result!.sourceId).toBe('1234567890123456789');
    });

    it('should not extract tweet ID from pbs.twimg.com (CDN)', () => {
      const result = parseSourceUrl(
        'https://pbs.twimg.com/media/AbCdEfGhIjK.jpg'
      );

      // CDN URLs don't contain tweet ID, so should return null
      expect(result).toBeNull();
    });
  });

  describe('DeviantArt URLs', () => {
    it('should parse art page URL', () => {
      const result = parseSourceUrl(
        'https://www.deviantart.com/artistname/art/Artwork-Title-123456789'
      );

      expect(result).not.toBeNull();
      expect(result!.sourceType).toBe(SourceType.DEVIANTART);
      expect(result!.sourceId).toBe('123456789');
    });

    it('should parse deviation URL', () => {
      const result = parseSourceUrl(
        'https://deviantart.com/deviation/123456789'
      );

      expect(result).not.toBeNull();
      expect(result!.sourceType).toBe(SourceType.DEVIANTART);
      expect(result!.sourceId).toBe('123456789');
    });

    it('should parse fav.me short URL', () => {
      const result = parseSourceUrl('https://fav.me/abc123');

      expect(result).not.toBeNull();
      expect(result!.sourceType).toBe(SourceType.DEVIANTART);
      expect(result!.sourceId).toBe('abc123');
    });
  });

  describe('Danbooru URLs', () => {
    it('should parse post URL', () => {
      const result = parseSourceUrl('https://danbooru.donmai.us/posts/1234567');

      expect(result).not.toBeNull();
      expect(result!.sourceType).toBe(SourceType.DANBOORU);
      expect(result!.sourceId).toBe('1234567');
    });
  });

  describe('Gelbooru URLs', () => {
    it('should parse URL with query params', () => {
      const result = parseSourceUrl(
        'https://gelbooru.com/index.php?page=post&s=view&id=12345'
      );

      expect(result).not.toBeNull();
      expect(result!.sourceType).toBe(SourceType.GELBOORU);
      expect(result!.sourceId).toBe('12345');
    });

    it('should parse URL with different query param order', () => {
      const result = parseSourceUrl(
        'https://gelbooru.com/index.php?id=12345&page=post&s=view'
      );

      expect(result).not.toBeNull();
      expect(result!.sourceType).toBe(SourceType.GELBOORU);
      expect(result!.sourceId).toBe('12345');
    });
  });

  describe('unknown URLs', () => {
    it('should return null for unknown URLs', () => {
      const result = parseSourceUrl('https://example.com/some/path');

      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = parseSourceUrl('');

      expect(result).toBeNull();
    });

    it('should return null for invalid URL', () => {
      const result = parseSourceUrl('not a url');

      expect(result).toBeNull();
    });
  });

  it('should preserve original URL', () => {
    const originalUrl = 'https://www.pixiv.net/artworks/12345678';
    const result = parseSourceUrl(originalUrl);

    expect(result!.originalUrl).toBe(originalUrl);
  });
});

describe('parseSourceUrls', () => {
  it('should parse multiple URLs', () => {
    const urls = [
      'https://www.pixiv.net/artworks/12345678',
      'https://twitter.com/user/status/1234567890',
    ];

    const result = parseSourceUrls(urls);

    expect(result).toHaveLength(2);
    expect(result[0].sourceType).toBe(SourceType.PIXIV);
    expect(result[1].sourceType).toBe(SourceType.TWITTER);
  });

  it('should deduplicate by sourceType:sourceId', () => {
    const urls = [
      'https://www.pixiv.net/artworks/12345678',
      'https://www.pixiv.net/en/artworks/12345678',
      'https://i.pximg.net/img-original/img/2023/01/01/12/00/00/12345678_p0.png',
    ];

    const result = parseSourceUrls(urls);

    // All three URLs have same Pixiv ID, should deduplicate to 1
    expect(result).toHaveLength(1);
    expect(result[0].sourceId).toBe('12345678');
  });

  it('should filter out unknown URLs', () => {
    const urls = [
      'https://www.pixiv.net/artworks/12345678',
      'https://example.com/unknown',
      'https://twitter.com/user/status/1234567890',
    ];

    const result = parseSourceUrls(urls);

    expect(result).toHaveLength(2);
  });

  it('should handle empty array', () => {
    const result = parseSourceUrls([]);

    expect(result).toHaveLength(0);
  });

  it('should return multiple sources for different IDs of same type', () => {
    const urls = [
      'https://www.pixiv.net/artworks/11111111',
      'https://www.pixiv.net/artworks/22222222',
    ];

    const result = parseSourceUrls(urls);

    expect(result).toHaveLength(2);
    expect(result[0].sourceId).toBe('11111111');
    expect(result[1].sourceId).toBe('22222222');
  });
});

describe('getCanonicalSourceUrl', () => {
  it('should generate correct Pixiv URL', () => {
    const result = getCanonicalSourceUrl(SourceType.PIXIV, '12345678');

    expect(result).toBe('https://www.pixiv.net/artworks/12345678');
  });

  it('should generate correct Twitter URL', () => {
    const result = getCanonicalSourceUrl(SourceType.TWITTER, '1234567890123456789');

    expect(result).toBe('https://twitter.com/i/status/1234567890123456789');
  });

  it('should generate correct DeviantArt URL', () => {
    const result = getCanonicalSourceUrl(SourceType.DEVIANTART, '123456789');

    expect(result).toBe('https://www.deviantart.com/deviation/123456789');
  });

  it('should generate correct Danbooru URL', () => {
    const result = getCanonicalSourceUrl(SourceType.DANBOORU, '1234567');

    expect(result).toBe('https://danbooru.donmai.us/posts/1234567');
  });

  it('should generate correct Gelbooru URL', () => {
    const result = getCanonicalSourceUrl(SourceType.GELBOORU, '12345');

    expect(result).toBe('https://gelbooru.com/index.php?page=post&s=view&id=12345');
  });

  it('should return empty string for OTHER source type', () => {
    const result = getCanonicalSourceUrl(SourceType.OTHER, 'anything');

    expect(result).toBe('');
  });
});
