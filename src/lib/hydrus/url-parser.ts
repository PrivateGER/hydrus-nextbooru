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

// Domains that host direct image files (not useful as source links)
const IMAGE_HOST_PATTERNS = [
  /^i\.pximg\.net$/i,
  /^pbs\.twimg\.com$/i,
  /^cdn\.donmai\.us$/i,
  /^img\d*\.gelbooru\.com$/i,
  /^wimg\.rule34\.xxx$/i,
  /\.wixmp\.com$/i, // DeviantArt CDN
];

// URL patterns that are API/ajax endpoints (not useful for users)
const API_ENDPOINT_PATTERNS = [
  /\/ajax\//i,
  /\/api\//i,
  /\?.*format=json/i,
];

/**
 * Check if a URL is a direct image host or API endpoint
 */
function isUselessUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Check if it's an image CDN
    if (IMAGE_HOST_PATTERNS.some(p => p.test(parsed.hostname))) {
      return true;
    }

    // Check if it's an API endpoint
    if (API_ENDPOINT_PATTERNS.some(p => p.test(url))) {
      return true;
    }

    return false;
  } catch {
    return true; // Invalid URLs are useless
  }
}

export interface DisplaySource {
  type: SourceType | null;
  sourceId: string | null;
  url: string;
  label: string;
}

/**
 * Get display label for a source type
 */
function getSourceLabel(type: SourceType): string {
  switch (type) {
    case SourceType.PIXIV:
      return "Pixiv";
    case SourceType.TWITTER:
      return "Twitter";
    case SourceType.DEVIANTART:
      return "DeviantArt";
    case SourceType.DANBOORU:
      return "Danbooru";
    case SourceType.GELBOORU:
      return "Gelbooru";
    default:
      return "Source";
  }
}

/**
 * Filter and canonicalize source URLs for display
 * - Converts recognized URLs to their canonical form
 * - Removes duplicate sources (same source type + ID)
 * - Filters out direct image links and API endpoints
 */
export function getDisplaySources(urls: string[]): DisplaySource[] {
  const results: DisplaySource[] = [];
  const seen = new Set<string>();

  for (const url of urls) {
    // Try to parse as a known source
    const parsed = parseSourceUrl(url);

    if (parsed) {
      // Use canonical URL for known sources
      const key = `${parsed.sourceType}:${parsed.sourceId}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          type: parsed.sourceType,
          sourceId: parsed.sourceId,
          url: getCanonicalSourceUrl(parsed.sourceType, parsed.sourceId),
          label: getSourceLabel(parsed.sourceType),
        });
      }
    } else if (!isUselessUrl(url) && !seen.has(url)) {
      // Keep unknown URLs that aren't useless
      seen.add(url);
      // Extract domain for label
      try {
        const domain = new URL(url).hostname.replace(/^www\./, "");
        results.push({
          type: null,
          sourceId: null,
          url,
          label: domain,
        });
      } catch {
        results.push({
          type: null,
          sourceId: null,
          url,
          label: "Link",
        });
      }
    }
  }

  return results;
}
