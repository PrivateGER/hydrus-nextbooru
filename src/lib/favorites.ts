import { prisma } from "@/lib/db";

/** Resolve a (lowercased) post hash to its numeric id. */
export async function getPostIdByHash(hash: string): Promise<number | null> {
  const post = await prisma.post.findUnique({
    where: { hash },
    select: { id: true },
  });
  return post?.id ?? null;
}

/**
 * Advisory-lock namespace for per-post preference mutations (favorite ⇄
 * dismissal). Passed as the first arg to the two-int
 * `pg_advisory_xact_lock(int4, int4)` so locks are scoped to
 * (namespace, postId): concurrent writes to the SAME post serialize while
 * different posts stay fully parallel. 74657 is an arbitrary fixed constant
 * that only has to be unique among this app's advisory-lock namespaces and
 * fit in int4.
 */
const FAVORITES_LOCK_NS = 74657;

/**
 * Mark a post as favorited. Idempotent.
 * Removes any feed dismissal for the post — a post cannot be both
 * favorited and "not interested".
 *
 * Runs in an interactive transaction holding a per-post advisory lock so a
 * concurrent setDismissal for the same post cannot interleave and leave both
 * a Favorite and a FeedDismissal row.
 */
export async function setFavorite(postId: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${FAVORITES_LOCK_NS}::int, ${postId}::int)`;
    await tx.feedDismissal.deleteMany({ where: { postId } });
    await tx.favorite.upsert({
      where: { postId },
      create: { postId },
      update: {},
    });
  });
}

/** Remove a favorite. Idempotent. */
export async function unsetFavorite(postId: number): Promise<void> {
  await prisma.favorite.deleteMany({ where: { postId } });
}

/**
 * Hide a post from the feed ("not interested"). Idempotent.
 * Removes any favorite for the post (mutual exclusion).
 *
 * Runs in an interactive transaction holding a per-post advisory lock so a
 * concurrent setFavorite for the same post cannot interleave and leave both
 * a Favorite and a FeedDismissal row.
 */
export async function setDismissal(postId: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${FAVORITES_LOCK_NS}::int, ${postId}::int)`;
    await tx.favorite.deleteMany({ where: { postId } });
    await tx.feedDismissal.upsert({
      where: { postId },
      create: { postId },
      update: {},
    });
  });
}

/** Remove a feed dismissal. Idempotent. */
export async function unsetDismissal(postId: number): Promise<void> {
  await prisma.feedDismissal.deleteMany({ where: { postId } });
}

/** Which of the given post ids are favorited. One indexed query. */
export async function getFavoritedPostIdSet(postIds: number[]): Promise<Set<number>> {
  if (postIds.length === 0) return new Set();
  const rows = await prisma.favorite.findMany({
    where: { postId: { in: postIds } },
    select: { postId: true },
  });
  return new Set(rows.map((row) => row.postId));
}

/**
 * Attach a `favorited` boolean to each post. Resolves which ids are favorited
 * in a single indexed query (via {@link getFavoritedPostIdSet}) and maps it
 * back, preserving input order. Kept out of the SQL layer so cached search
 * results can be decorated with fresh favorite state after retrieval.
 */
export async function mergeFavoritedState<T extends { id: number }>(
  posts: T[],
): Promise<(T & { favorited: boolean })[]> {
  const favoritedIds = await getFavoritedPostIdSet(posts.map((post) => post.id));
  return posts.map((post) => ({ ...post, favorited: favoritedIds.has(post.id) }));
}
