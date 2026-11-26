/**
 * Swipe-deck view of the "For You" feed.
 *
 * The swipe page walks the same cached ranking as /recommended, but a deck
 * cannot page by offset: every like invalidates the feed and the rebuilt
 * ranking reshuffles, so page N after a rebuild no longer follows page N-1.
 * Instead the client sends the hashes it has already seen (liked, skipped,
 * or still queued) and receives the top-ranked posts it has not, enriched
 * with what a full-screen card needs (file extension, video metadata, and
 * headline artist/character/copyright tags) in one constant-cost query.
 */

import { prisma } from "@/lib/db";
import { FEED_CONFIG, getFeedPage, type FeedPost } from "@/lib/feed";

/** Largest batch a single deck request may return. */
export const MAX_DECK_LIMIT = 30;
/** Default batch size: enough to keep a few cards preloaded between refills. */
export const DEFAULT_DECK_LIMIT = 10;
/**
 * Most excluded hashes honored per request. The ranked feed itself is capped
 * at {@link FEED_CONFIG.maxFeedSize}, so a client never needs more than that
 * plus some slack for posts that dropped out of the ranking.
 */
export const MAX_DECK_EXCLUDE = 1500;
/** Headline tags shown per category on a card. */
export const DECK_TAGS_PER_CATEGORY = 3;

const HASH_PATTERN = /^[a-f0-9]{64}$/;

export interface DeckPost extends Omit<FeedPost, "score"> {
  extension: string;
  /** Milliseconds, videos only. */
  duration: number | null;
  hasAudio: boolean;
  artists: string[];
  characters: string[];
  copyrights: string[];
}

export interface DeckResult {
  posts: DeckPost[];
  /** Unseen posts left in the ranking after this batch. */
  remaining: number;
  /** Size of the whole ranked feed, seen or not. */
  totalCount: number;
}

/**
 * Normalize a client-supplied exclude list: keep only well-formed hashes
 * (lowercased), dedupe, and cap the count. Invalid entries are dropped rather
 * than rejected so one stale/corrupt localStorage entry cannot brick the deck.
 */
export function parseExcludeList(input: unknown, max: number = MAX_DECK_EXCLUDE): Set<string> {
  const result = new Set<string>();
  if (!Array.isArray(input)) return result;
  for (const value of input) {
    if (result.size >= max) break;
    if (typeof value !== "string") continue;
    const hash = value.toLowerCase();
    if (HASH_PATTERN.test(hash)) result.add(hash);
  }
  return result;
}

/** Top `limit` posts of the ranking whose hash is not excluded, in rank order. */
export function selectDeckCandidates(
  feed: readonly FeedPost[],
  exclude: ReadonlySet<string>,
  limit: number
): { picked: FeedPost[]; unseen: number } {
  const picked: FeedPost[] = [];
  let unseen = 0;
  for (const post of feed) {
    if (exclude.has(post.hash)) continue;
    unseen++;
    if (picked.length < limit) picked.push(post);
  }
  return { picked, unseen };
}

interface DeckDetailRow {
  id: number;
  extension: string;
  duration: number | null;
  hasAudio: boolean;
  artists: string[];
  characters: string[];
  copyrights: string[];
}

/**
 * One statement for any batch size: per-post extension and video metadata
 * plus headline tags per category, most popular first.
 */
async function getDeckDetails(postIds: number[]): Promise<Map<number, DeckDetailRow>> {
  if (postIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<DeckDetailRow[]>`
    SELECT
      p.id,
      p.extension,
      p.duration,
      p."hasAudio",
      COALESCE(array_agg(t.name ORDER BY t."postCount" DESC, t.name)
        FILTER (WHERE t.category = 'ARTIST'), '{}') AS artists,
      COALESCE(array_agg(t.name ORDER BY t."postCount" DESC, t.name)
        FILTER (WHERE t.category = 'CHARACTER'), '{}') AS characters,
      COALESCE(array_agg(t.name ORDER BY t."postCount" DESC, t.name)
        FILTER (WHERE t.category = 'COPYRIGHT'), '{}') AS copyrights
    FROM "Post" p
    LEFT JOIN "PostTag" pt ON pt."postId" = p.id
    LEFT JOIN "Tag" t
      ON t.id = pt."tagId"
     AND t.category IN ('ARTIST', 'CHARACTER', 'COPYRIGHT')
    WHERE p.id = ANY(${postIds}::int[])
    GROUP BY p.id
  `;
  return new Map(rows.map((row) => [row.id, row]));
}

/**
 * Next batch of unseen feed posts for the swipe deck. Served from the cached
 * feed ranking; the only extra cost is one enrichment statement for the
 * returned batch. Posts whose row vanished since the ranking was cached
 * (deleted by a sync) are skipped.
 *
 * Precondition: `limit` is a sanitized positive integer.
 */
export async function getFeedDeck(exclude: ReadonlySet<string>, limit: number): Promise<DeckResult> {
  const { posts: feed, totalCount } = await getFeedPage(1, FEED_CONFIG.maxFeedSize);
  const { picked, unseen } = selectDeckCandidates(feed, exclude, limit);
  const details = await getDeckDetails(picked.map((post) => post.id));

  const posts: DeckPost[] = [];
  for (const post of picked) {
    const detail = details.get(post.id);
    if (!detail) continue;
    posts.push({
      id: post.id,
      hash: post.hash,
      width: post.width,
      height: post.height,
      blurhash: post.blurhash,
      mimeType: post.mimeType,
      extension: detail.extension,
      duration: detail.duration,
      hasAudio: detail.hasAudio,
      artists: detail.artists.slice(0, DECK_TAGS_PER_CATEGORY),
      characters: detail.characters.slice(0, DECK_TAGS_PER_CATEGORY),
      copyrights: detail.copyrights.slice(0, DECK_TAGS_PER_CATEGORY),
    });
  }

  return { posts, remaining: unseen - picked.length, totalCount };
}
