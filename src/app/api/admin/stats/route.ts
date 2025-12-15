import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { updateHomeStatsCache } from "@/lib/stats";
import { invalidateAllCaches } from "@/lib/cache";

/**
 * Recalculate postCount for all tags.
 */
async function recalculateTagCounts(): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "Tag" t SET "postCount" = (
      SELECT COUNT(*) FROM "PostTag" pt WHERE pt."tagId" = t.id
    )
  `;
}

/**
 * Update the total post count stored in Settings.
 */
async function updateTotalPostCount(): Promise<void> {
  const count = await prisma.post.count();
  await prisma.settings.upsert({
    where: { key: "stats.totalPostCount" },
    update: { value: count.toString() },
    create: { key: "stats.totalPostCount", value: count.toString() },
  });
}

/**
 * POST /api/admin/stats
 * Recalculate all tag counts and homepage stats.
 */
export async function POST() {
  try {
    // Recalculate tag counts
    await recalculateTagCounts();

    // Update total post count
    await updateTotalPostCount();

    // Update homepage stats cache
    await updateHomeStatsCache();

    // Invalidate all caches
    invalidateAllCaches();

    return NextResponse.json({
      success: true,
      message: "All stats recalculated successfully",
    });
  } catch (error) {
    console.error("Error recalculating stats:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to recalculate stats",
      },
      { status: 500 }
    );
  }
}
