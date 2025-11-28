import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { withBlacklistFilter, filterBlacklistedTags } from "@/lib/tag-blacklist";
import { tagIdCache, postIdsCache, treeResponseCache } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const selectedParam = searchParams.get("selected") || "";
  const category = searchParams.get("category") || "";
  const query = searchParams.get("q") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

  // Parse selected tags (comma-separated)
  const selectedTags = selectedParam
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);

  // Build cache key for response caching
  const sortedSelectedTags = [...selectedTags].sort();
  const cacheKey = `${sortedSelectedTags.join(",")}|${category}|${query}|${limit}`;

  // Check response cache first
  const cached = treeResponseCache.get(cacheKey);
  if (cached) {
    return NextResponse.json({
      tags: cached.tags,
      postCount: cached.postCount,
      selectedTags,
    });
  }

  // If no tags are selected, return top tags or search results
  if (selectedTags.length === 0) {
    const baseWhere: Prisma.TagWhereInput = {};
    if (category) {
      baseWhere.category = category as Prisma.EnumTagCategoryFilter;
    }
    if (query) {
      baseWhere.name = {
        contains: query,
        mode: "insensitive",
      };
    }

    const [tags, totalPosts] = await Promise.all([
      prisma.tag.findMany({
        where: withBlacklistFilter(baseWhere),
        select: {
          id: true,
          name: true,
          category: true,
          _count: {
            select: { posts: true },
          },
        },
        orderBy: [{ posts: { _count: "desc" } }],
        take: limit,
      }),
      prisma.post.count(),
    ]);

    const result = {
      tags: tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        category: tag.category,
        count: tag._count.posts,
      })),
      postCount: totalPosts,
    };

    // Cache the response
    treeResponseCache.set(cacheKey, result);

    return NextResponse.json({
      ...result,
      selectedTags: [],
    });
  }

  // Step 1: Resolve tag names to IDs (with caching)
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
    return NextResponse.json({
      tags: [],
      postCount: 0,
      selectedTags,
    });
  }

  // Step 2: Find posts that have ALL selected tags (with caching)
  const sortedTagIds = [...selectedTagIds].sort((a, b) => a - b);
  const postIdsCacheKey = sortedTagIds.join(",");

  let postIds = postIdsCache.get(postIdsCacheKey);

  if (!postIds) {
    // Use groupBy with having - much faster than nested AND subqueries
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

  const postCount = postIds.length;

  if (postCount === 0) {
    return NextResponse.json({
      tags: [],
      postCount: 0,
      selectedTags,
    });
  }

  // Step 3: Find tags that appear on these posts (excluding already selected)
  const baseWhere: Prisma.TagWhereInput = {
    // Exclude already selected tags by ID (faster than name comparison)
    id: { notIn: selectedTagIds },
    // Only tags on posts with all selected tags
    posts: {
      some: {
        postId: { in: postIds },
      },
    },
  };

  if (category) {
    baseWhere.category = category as Prisma.EnumTagCategoryFilter;
  }

  if (query) {
    baseWhere.name = {
      contains: query,
      mode: "insensitive",
    };
  }

  // Use _count aggregation - database does the counting, not JS
  const tags = await prisma.tag.findMany({
    where: withBlacklistFilter(baseWhere),
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
    take: limit * 2, // Over-fetch to account for blacklist filtering
  });

  // Map and filter results
  const mappedTags = tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    category: tag.category,
    count: tag._count.posts,
  }));

  const sortedTags = filterBlacklistedTags(mappedTags)
    .filter((tag) => tag.count > 0)
    .slice(0, limit);

  const result = {
    tags: sortedTags,
    postCount,
  };

  // Cache the response
  treeResponseCache.set(cacheKey, result);

  return NextResponse.json({
    ...result,
    selectedTags,
  });
}
