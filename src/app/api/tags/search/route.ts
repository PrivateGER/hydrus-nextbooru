import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { withBlacklistFilter, filterBlacklistedTags } from "@/lib/tag-blacklist";
import { tagIdCache } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);
  const selectedParam = searchParams.get("selected") || "";

  // Parse selected tags (comma-separated)
  const selectedTags = selectedParam
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);

  if (query.length < 1) {
    return NextResponse.json({ tags: [] });
  }

  // If no tags are selected, use simple search with pre-computed postCount
  if (selectedTags.length === 0) {
    const tags = await prisma.tag.findMany({
      where: withBlacklistFilter({
        name: {
          contains: query,
          mode: "insensitive",
        },
      }),
      select: {
        id: true,
        name: true,
        category: true,
        postCount: true,
      },
      orderBy: { postCount: "desc" },
      take: limit,
    });

    return NextResponse.json({
      tags: tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        category: tag.category,
        count: tag.postCount,
      })),
    });
  }

  // Progressive filtering: find tags that co-occur with all selected tags

  // Step 1: Find tag IDs for selected tags (with caching)
  const selectedTagIds: number[] = [];
  const uncachedTagNames: string[] = [];

  for (const tagName of selectedTags) {
    const cachedId = tagIdCache.get(tagName);
    if (cachedId !== undefined) {
      selectedTagIds.push(cachedId);
    } else {
      uncachedTagNames.push(tagName);
    }
  }

  // Fetch any uncached tag IDs
  if (uncachedTagNames.length > 0) {
    const tagRecords = await prisma.tag.findMany({
      where: {
        name: { in: uncachedTagNames, mode: "insensitive" },
      },
      select: { id: true, name: true },
    });

    for (const tag of tagRecords) {
      tagIdCache.set(tag.name.toLowerCase(), tag.id);
      selectedTagIds.push(tag.id);
    }
  }

  // If not all selected tags exist, no results possible
  if (selectedTagIds.length !== selectedTags.length) {
    return NextResponse.json({ tags: [] });
  }

  // Step 2: Single efficient query to find co-occurring tags
  // Uses a subquery to find posts with ALL selected tags, then counts tag occurrences
  const searchPattern = `%${query.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

  const coOccurringTags = await prisma.$queryRaw<Array<{
    id: number;
    name: string;
    category: string;
    count: bigint;
  }>>(
    Prisma.sql`
      SELECT t.id, t.name, t.category, COUNT(*)::bigint as count
      FROM "Tag" t
      JOIN "PostTag" pt ON t.id = pt."tagId"
      WHERE t.name ILIKE ${searchPattern}
        AND t.id != ALL(${selectedTagIds}::int[])
        AND pt."postId" IN (
          SELECT pt2."postId"
          FROM "PostTag" pt2
          WHERE pt2."tagId" = ANY(${selectedTagIds}::int[])
          GROUP BY pt2."postId"
          HAVING COUNT(*) = ${selectedTagIds.length}
        )
      GROUP BY t.id, t.name, t.category
      ORDER BY count DESC
      LIMIT ${limit * 2}
    `
  );

  // Apply blacklist filter in memory (simpler than dynamic SQL for complex patterns)
  const mappedTags = coOccurringTags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    category: tag.category,
    count: Number(tag.count),
  }));

  const filteredTags = filterBlacklistedTags(mappedTags)
    .filter((tag) => tag.count > 0)
    .slice(0, limit);

  return NextResponse.json({ tags: filteredTags });
}
