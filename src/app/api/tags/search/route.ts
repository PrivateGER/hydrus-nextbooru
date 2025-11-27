import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withBlacklistFilter, filterBlacklistedTags } from "@/lib/tag-blacklist";
import { tagIdCache, postIdsCache } from "@/lib/cache";

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

  // If no tags are selected, use simple search
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
        _count: {
          select: { posts: true },
        },
      },
      orderBy: [
        { posts: { _count: "desc" } },
      ],
      take: limit,
    });

    return NextResponse.json({
      tags: tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        category: tag.category,
        count: tag._count.posts,
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

  // Step 2: Find posts that have ALL selected tags (with caching)
  const sortedTagIds = [...selectedTagIds].sort((a, b) => a - b);
  const postIdsCacheKey = sortedTagIds.join(",");

  let postIds = postIdsCache.get(postIdsCacheKey);

  if (!postIds) {
    const postsWithAllTags = await prisma.postTag.groupBy({
      by: ["postId"],
      where: {
        tagId: { in: selectedTagIds },
      },
      having: {
        tagId: { _count: { equals: selectedTagIds.length } },
      },
    });
    postIds = postsWithAllTags.map((p) => p.postId);
    postIdsCache.set(postIdsCacheKey, postIds);
  }

  if (postIds.length === 0) {
    return NextResponse.json({ tags: [] });
  }

  // Step 3: Find tags matching query that appear on these posts
  const tags = await prisma.tag.findMany({
    where: withBlacklistFilter({
      name: {
        contains: query,
        mode: "insensitive",
      },
      // Exclude already selected tags
      id: { notIn: selectedTagIds },
      // Only tags on posts with all selected tags
      posts: {
        some: {
          postId: { in: postIds },
        },
      },
    }),
    select: {
      id: true,
      name: true,
      category: true,
      _count: {
        select: {
          posts: {
            where: {
              postId: { in: postIds },
            },
          },
        },
      },
    },
    orderBy: {
      posts: { _count: "desc" },
    },
    take: limit * 2,
  });

  // Apply blacklist filter and map results
  const mappedTags = tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    category: tag.category,
    count: tag._count.posts,
  }));

  const filteredTags = filterBlacklistedTags(mappedTags)
    .filter((tag) => tag.count > 0)
    .slice(0, limit);

  return NextResponse.json({ tags: filteredTags });
}
