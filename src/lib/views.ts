import { prisma } from "@/lib/db";

/**
 * Record an implicit view of a post (opening its detail page).
 *
 * First view creates the row (viewCount defaults to 1); subsequent views bump
 * the counter and refresh lastViewedAt. Idempotency is intentionally NOT
 * enforced — repeated opens are the signal (stronger interest), and the feed's
 * viewCount saturation keeps a heavily re-opened post from dominating.
 */
export async function recordPostView(postId: number): Promise<void> {
  await prisma.postView.upsert({
    where: { postId },
    create: { postId },
    update: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
  });
}
