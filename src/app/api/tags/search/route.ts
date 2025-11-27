import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withBlacklistFilter, filterBlacklistedTags } from "@/lib/tag-blacklist";

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
  // Use a single query with filtered _count for efficiency
  const tags = await prisma.tag.findMany({
    where: withBlacklistFilter({
      name: {
        contains: query,
        mode: "insensitive",
      },
      // Exclude already selected tags
      NOT: {
        name: {
          in: selectedTags,
          mode: "insensitive",
        },
      },
      // Only tags that appear on posts with all selected tags
      posts: {
        some: {
          post: {
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
              post: {
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
            },
          },
        },
      },
    },
    orderBy: {
      posts: { _count: "desc" },
    },
    take: limit * 2, // Take more to account for blacklist filtering
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
