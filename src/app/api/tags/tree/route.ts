import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

  // If no tags are selected, return top tags or search results
  if (selectedTags.length === 0) {
    const whereClause: Record<string, unknown> = {};
    if (category) {
      whereClause.category = category;
    }
    if (query) {
      whereClause.name = {
        contains: query,
        mode: "insensitive",
      };
    }

    const tags = await prisma.tag.findMany({
      where: whereClause,
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
    });

    // Get total post count for percentage calculation
    const totalPosts = await prisma.post.count();

    return NextResponse.json({
      tags: tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        category: tag.category,
        count: tag._count.posts,
      })),
      postCount: totalPosts,
      selectedTags: [],
    });
  }

  // Find posts that have ALL selected tags
  const postsWithSelectedTags = await prisma.post.findMany({
    where: {
      AND: selectedTags.map((tagName) => ({
        tags: {
          some: {
            tag: {
              name: {
                equals: tagName,
                mode: "insensitive",
              },
            },
          },
        },
      })),
    },
    select: { id: true },
  });

  const postIds = postsWithSelectedTags.map((p) => p.id);
  const postCount = postIds.length;

  if (postCount === 0) {
    return NextResponse.json({
      tags: [],
      postCount: 0,
      selectedTags,
    });
  }

  // Find all tags that appear on these posts (excluding already selected)
  const whereClause: Record<string, unknown> = {
    NOT: {
      name: {
        in: selectedTags,
        mode: "insensitive",
      },
    },
    posts: {
      some: {
        postId: { in: postIds },
      },
    },
  };

  if (category) {
    whereClause.category = category;
  }

  if (query) {
    whereClause.name = {
      contains: query,
      mode: "insensitive",
    };
  }

  const tags = await prisma.tag.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      category: true,
      posts: {
        where: {
          postId: { in: postIds },
        },
        select: { postId: true },
      },
    },
  });

  // Sort by count and limit
  const sortedTags = tags
    .map((tag) => ({
      id: tag.id,
      name: tag.name,
      category: tag.category,
      count: tag.posts.length,
    }))
    .filter((tag) => tag.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return NextResponse.json({
    tags: sortedTags,
    postCount,
    selectedTags,
  });
}
