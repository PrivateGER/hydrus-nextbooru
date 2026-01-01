import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { TagCategory, Prisma } from "@/generated/prisma/client";
import { withBlacklistFilter } from "@/lib/tag-blacklist";

const VALID_CATEGORIES = Object.values(TagCategory);
const VALID_SORT_OPTIONS = ["count", "name", "-count", "-name"] as const;
type SortOption = (typeof VALID_SORT_OPTIONS)[number];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const query = searchParams.get("q")?.trim() || "";
  const category = searchParams.get("category")?.toUpperCase() as TagCategory | undefined;
  const sort = (searchParams.get("sort") || "count") as SortOption;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "100", 10)), 200);

  const skip = (page - 1) * limit;

  // Build where clause
  const baseWhere: Prisma.TagWhereInput = {};

  if (query) {
    baseWhere.name = {
      contains: query,
      mode: "insensitive",
    };
  }

  if (category && VALID_CATEGORIES.includes(category)) {
    baseWhere.category = category;
  }

  // Apply blacklist filter
  const where = withBlacklistFilter(baseWhere);

  // Build order clause using indexed postCount field
  let orderBy: Prisma.TagOrderByWithRelationInput;
  switch (sort) {
    case "name":
      orderBy = { name: "asc" };
      break;
    case "-name":
      orderBy = { name: "desc" };
      break;
    case "-count":
      orderBy = { postCount: "asc" };
      break;
    case "count":
    default:
      orderBy = { postCount: "desc" };
      break;
  }

  const [tags, totalCount] = await Promise.all([
    prisma.tag.findMany({
      where,
      select: {
        id: true,
        name: true,
        category: true,
        postCount: true,
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.tag.count({ where }),
  ]);

  return NextResponse.json({
    tags: tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      category: tag.category,
      count: tag.postCount,
    })),
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  });
}
