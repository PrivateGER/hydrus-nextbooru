import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const DEFAULT_LIMIT = 48;
const MAX_LIMIT = 100;

/**
 * Split a comma-separated tag string into included and excluded tag lists.
 *
 * Leading/trailing whitespace is trimmed and tags are lowercased; empty entries are ignored.
 *
 * @param tagsParam - Comma-separated tags where tags prefixed with `-` denote exclusion (e.g., "cat,-dog,  bird")
 * @returns An object with `includeTags` (tags to include) and `excludeTags` (tags to exclude)
 */
export function parseTagsWithNegation(tagsParam: string): {
  includeTags: string[];
  excludeTags: string[];
} {
  const allTags = tagsParam
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);

  const includeTags: string[] = [];
  const excludeTags: string[] = [];

  for (const tag of allTags) {
    if (tag.startsWith("-") && tag.length > 1) {
      excludeTags.push(tag.slice(1));
    } else {
      includeTags.push(tag);
    }
  }

  return { includeTags, excludeTags };
}

/**
 * Handle GET requests to search posts filtered by included and excluded tags with pagination.
 *
 * If both include and exclude tag lists are empty, responds with empty results.
 *
 * @returns A JSON object with `posts` — an array of matching posts (each containing `id`, `hash`, `width`, `height`, `blurhash`, and `mimeType`), `totalCount` — total number of matching posts, and `totalPages` — number of pages based on the applied `limit`.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tagsParam = searchParams.get("tags") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10),
    MAX_LIMIT
  );

  // Parse tags with negation support
  const { includeTags, excludeTags } = parseTagsWithNegation(tagsParam);

  if (includeTags.length === 0 && excludeTags.length === 0) {
    return NextResponse.json({
      posts: [],
      totalCount: 0,
      totalPages: 0,
    });
  }

  const skip = (page - 1) * limit;

  // Build where clause with AND for included tags and NONE for excluded tags
  const andConditions: object[] = [];

  // Include tags: posts must have ALL specified tags
  for (const tagName of includeTags) {
    andConditions.push({
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
    });
  }

  // Exclude tags: posts must NOT have ANY of the excluded tags
  for (const tagName of excludeTags) {
    andConditions.push({
      tags: {
        none: {
          tag: {
            name: {
              equals: tagName,
              mode: "insensitive" as const,
            },
          },
        },
      },
    });
  }

  const whereClause = andConditions.length > 0 ? { AND: andConditions } : {};

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