import { prisma } from "@/lib/db";

export type FeedSwipeOutcome = "like" | "skip";

/**
 * Record how a swipe-feed card was answered: the latest swipe per post, and
 * whether the card was dealt as exploration.
 *
 * This is a record of what was shown, not a taste signal: it does not
 * invalidate the feed, and a skip never lowers a post in the ranking (a like
 * becomes a favorite through its own route). Its two uses are judging
 * exploration ({@link getFeedSwipeStats}, shown in the admin panel) and keeping answered posts out of
 * the pool exploration draws from.
 */
export async function recordFeedSwipe(
  postId: number,
  outcome: FeedSwipeOutcome,
  explore: boolean
): Promise<void> {
  const action = outcome === "like" ? "LIKE" : "SKIP";
  await prisma.feedSwipe.upsert({
    where: { postId },
    create: { postId, action, explore },
    update: { action, explore, swipedAt: new Date() },
  });
}

/**
 * Forget a swipe (the deck's undo). Idempotent.
 *
 * There is one record per post, so this also forgets an answer from an
 * earlier session if the post was dealt again and re-answered before the
 * undo. Accepted: it needs a re-deal plus an undo, and costs one stat entry.
 */
export async function removeFeedSwipe(postId: number): Promise<void> {
  await prisma.feedSwipe.deleteMany({ where: { postId } });
}

export interface FeedSwipeCounts {
  liked: number;
  skipped: number;
  /** liked / (liked + skipped), or null before the first swipe. */
  likeRate: number | null;
}

export interface FeedSwipeStats {
  /** Cards from the taste model. */
  taste: FeedSwipeCounts;
  /** Cards dealt as exploration. */
  explore: FeedSwipeCounts;
}

/**
 * Like rate of exploration cards next to taste cards: the measure of whether
 * exploration is finding things worth keeping. One grouped statement.
 */
export async function getFeedSwipeStats(since?: Date): Promise<FeedSwipeStats> {
  const groups = await prisma.feedSwipe.groupBy({
    by: ["explore", "action"],
    where: since ? { swipedAt: { gte: since } } : undefined,
    _count: { _all: true },
  });
  const counts = (explore: boolean): FeedSwipeCounts => {
    let liked = 0;
    let skipped = 0;
    for (const group of groups) {
      if (group.explore !== explore) continue;
      if (group.action === "LIKE") liked += group._count._all;
      else skipped += group._count._all;
    }
    const total = liked + skipped;
    return { liked, skipped, likeRate: total > 0 ? liked / total : null };
  };
  return { taste: counts(false), explore: counts(true) };
}
