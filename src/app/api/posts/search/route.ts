import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const DEFAULT_LIMIT = 48;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tagsParam = searchParams.get("tags") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10),
    MAX_LIMIT
  );

  // Parse tags
  const tags = tagsParam
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);

  if (tags.length === 0) {
    return NextResponse.json({
      posts: [],
      totalCount: 0,
      totalPages: 0,
    });
  }

  const skip = (page - 1) * limit;

  // Find posts that have ALL specified tags
  const whereClause = {
    AND: tags.map((tagName) => ({
      tags: {
        some: {
          tag: {
            name: {
              equals: tagName,
              mode: "insensitive" as const,
            },
          },
        },
      },
    })),
  };

  const [posts, totalCount] = await Promise.all([
    prisma.post.findMany({
      where: whereClause,
      orderBy: { importedAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        hash: true,
        width: true,
        height: true,
        blurhash: true,
        mimeType: true,
      },
    }),
    prisma.post.count({ where: whereClause }),
  ]);

  return NextResponse.json({
    posts,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
  });
}
