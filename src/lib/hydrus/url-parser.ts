import { SourceType } from "@/generated/prisma/client";

export interface ParsedSourceUrl {
  sourceType: SourceType;
  sourceId: string;
  originalUrl: string;
}

// Regex patterns for various source URLs
const URL_PATTERNS: { type: SourceType; patterns: RegExp[] }[] = [
  {
    type: SourceType.PIXIV,
    patterns: [
      // https://www.pixiv.net/artworks/12345678
      /pixiv\.net\/(?:en\/)?artworks\/(\d+)/i,
      // https://www.pixiv.net/member_illust.php?illust_id=12345678
      /pixiv\.net\/member_illust\.php\?.*illust_id=(\d+)/i,
      // https://i.pximg.net/img-original/img/2020/01/01/00/00/00/12345678_p0.png
      /pximg\.net\/.*\/(\d+)_p\d+/i,
    ],
  },
  {
    type: SourceType.TWITTER,
    patterns: [
      // https://twitter.com/username/status/1234567890123456789
      /(?:twitter|x)\.com\/\w+\/status\/(\d+)/i,
      // https://pbs.twimg.com/media/... (can't extract tweet ID from this)
    ],
  },
  {
    type: SourceType.DEVIANTART,
    patterns: [
      // https://www.deviantart.com/username/art/Title-Here-123456789
      /deviantart\.com\/[\w-]+\/art\/[\w-]+-(\d+)/i,
      // https://deviantart.com/deviation/123456789
      /deviantart\.com\/deviation\/(\d+)/i,
      // https://fav.me/abc123 (base36 encoded deviation ID)
      /fav\.me\/([a-z0-9]+)/i,
    ],
  },
  {
    type: SourceType.DANBOORU,
    patterns: [
      // https://danbooru.donmai.us/posts/12345
      /danbooru\.donmai\.us\/posts\/(\d+)/i,
      // https://cdn.donmai.us/original/ab/cd/abcd...123.ext (can't extract post ID)
    ],
  },
  {
    type: SourceType.GELBOORU,
    patterns: [
      // https://gelbooru.com/index.php?page=post&s=view&id=12345
      /gelbooru\.com\/index\.php\?.*[?&]id=(\d+)/i,
      // https://gelbooru.com/index.php?page=post&s=view&id=12345 (alternate order)
      /gelbooru\.com\/.*[?&]id=(\d+)/i,
    ],
  },
];

/**
 * Parse a URL and extract source type and ID
 */
export function parseSourceUrl(url: string): ParsedSourceUrl | null {
  for (const { type, patterns } of URL_PATTERNS) {
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return {
          sourceType: type,
          sourceId: match[1],
          originalUrl: url,
        };
      }
    }
  }

  return null;
}

/**
 * Parse multiple URLs and extract unique source IDs
 */
export function parseSourceUrls(urls: string[]): ParsedSourceUrl[] {
  const results: ParsedSourceUrl[] = [];
  const seen = new Set<string>();

  for (const url of urls) {
    const parsed = parseSourceUrl(url);
    if (parsed) {
      const key = `${parsed.sourceType}:${parsed.sourceId}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push(parsed);
      }
    }
  }

  return results;
}

/**
 * Check if any URL is from a known source
 */
export function hasKnownSource(urls: string[]): boolean {
  return urls.some((url) => parseSourceUrl(url) !== null);
}

// Source priority order (higher = preferred)
const SOURCE_PRIORITY: SourceType[] = [
  SourceType.PIXIV,
  SourceType.DEVIANTART,
  SourceType.TWITTER,
  SourceType.DANBOORU,
  SourceType.GELBOORU,
  SourceType.OTHER,
];

/**
 * Get the primary source from a list of URLs
 * Prefers original sources (Pixiv, DeviantArt) over aggregators (Danbooru)
 */
export function getPrimarySource(urls: string[]): ParsedSourceUrl | null {
  const sources = parseSourceUrls(urls);
  if (sources.length === 0) return null;

  // Sort by priority and return the highest
  sources.sort((a, b) => {
    const priorityA = SOURCE_PRIORITY.indexOf(a.sourceType);
    const priorityB = SOURCE_PRIORITY.indexOf(b.sourceType);
    return priorityA - priorityB;
  });

  return sources[0];
}

/**
 * Generate a canonical source URL for display
 */
export function getCanonicalSourceUrl(sourceType: SourceType, sourceId: string): string {
  switch (sourceType) {
    case SourceType.PIXIV:
      return `https://www.pixiv.net/artworks/${sourceId}`;
    case SourceType.TWITTER:
      return `https://twitter.com/i/status/${sourceId}`;
    case SourceType.DEVIANTART:
      return `https://www.deviantart.com/deviation/${sourceId}`;
    case SourceType.DANBOORU:
      return `https://danbooru.donmai.us/posts/${sourceId}`;
    case SourceType.GELBOORU:
      return `https://gelbooru.com/index.php?page=post&s=view&id=${sourceId}`;
    default:
      return "";
  }
}
