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
 * Mark a post as favorited. Idempotent.
 * Removes any feed dismissal for the post — a post cannot be both
 * favorited and "not interested".
 */
export async function setFavorite(postId: number): Promise<void> {
  await prisma.$transaction([
    prisma.feedDismissal.deleteMany({ where: { postId } }),
    prisma.favorite.upsert({
      where: { postId },
      create: { postId },
      update: {},
    }),
  ]);
}

/** Remove a favorite. Idempotent. */
export async function unsetFavorite(postId: number): Promise<void> {
  await prisma.favorite.deleteMany({ where: { postId } });
}

/**
 * Hide a post from the feed ("not interested"). Idempotent.
 * Removes any favorite for the post (mutual exclusion).
 */
export async function setDismissal(postId: number): Promise<void> {
  await prisma.$transaction([
    prisma.favorite.deleteMany({ where: { postId } }),
    prisma.feedDismissal.upsert({
      where: { postId },
      create: { postId },
      update: {},
    }),
  ]);
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
