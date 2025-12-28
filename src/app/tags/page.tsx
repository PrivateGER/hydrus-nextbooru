import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { TagCategory, Prisma } from "@/generated/prisma/client";
import { Pagination } from "@/components/pagination";
import { TagSearch } from "./tag-search";
import { withBlacklistFilter } from "@/lib/tag-blacklist";
import {
  tagsCategoryCountsCache,
  tagsPageCache,
  type TagsCategoryCounts,
  type TagsPageEntry,
} from "@/lib/cache";

const TAGS_PER_PAGE = 100;

const CATEGORY_ORDER: (TagCategory | "ALL")[] = [
  "ALL",
  TagCategory.ARTIST,
  TagCategory.COPYRIGHT,
  TagCategory.CHARACTER,
  TagCategory.GENERAL,
  TagCategory.META,
];

const CATEGORY_COLORS: Record<TagCategory, string> = {
  [TagCategory.ARTIST]: "text-red-400 hover:text-red-300",
  [TagCategory.COPYRIGHT]: "text-purple-400 hover:text-purple-300",
  [TagCategory.CHARACTER]: "text-green-400 hover:text-green-300",
  [TagCategory.GENERAL]: "text-blue-400 hover:text-blue-300",
  [TagCategory.META]: "text-orange-400 hover:text-orange-300",
};

const CATEGORY_LABELS: Record<TagCategory | "ALL", string> = {
  ALL: "All",
  [TagCategory.ARTIST]: "Artists",
  [TagCategory.COPYRIGHT]: "Copyrights",
  [TagCategory.CHARACTER]: "Characters",
  [TagCategory.GENERAL]: "General",
  [TagCategory.META]: "Meta",
};

interface TagsPageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    sort?: string;
    page?: string;
  }>;
}

type SortOption = "count" | "name" | "-count" | "-name";

async function getTags(options: {
  query: string;
  category: TagCategory | null;
  sort: SortOption;
  page: number;
}): Promise<TagsPageEntry> {
  const { query, category, sort, page } = options;

  // Only cache when no search query (search queries are too unique)
  const cacheKey = query ? null : `${category || "ALL"}:${sort}:${page}`;

  if (cacheKey) {
    const cached = tagsPageCache.get(cacheKey);
    if (cached) return cached;
  }

  const skip = (page - 1) * TAGS_PER_PAGE;

  const baseWhere: Prisma.TagWhereInput = {};

  if (query) {
    baseWhere.name = {
      contains: query,
      mode: "insensitive",
    };
  }

  if (category) {
    baseWhere.category = category;
  }

  // Apply blacklist filter
  const where = withBlacklistFilter(baseWhere);

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
      take: TAGS_PER_PAGE,
    }),
    prisma.tag.count({ where }),
  ]);

  const result: TagsPageEntry = {
    tags: tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      category: tag.category,
      count: tag.postCount,
    })),
    totalCount,
    totalPages: Math.ceil(totalCount / TAGS_PER_PAGE),
  };

  if (cacheKey) {
    tagsPageCache.set(cacheKey, result);
  }

  return result;
}

async function getCategoryCounts(): Promise<TagsCategoryCounts> {
  // Check cache first - category counts rarely change
  const cached = tagsCategoryCountsCache.get("counts");
  if (cached) return cached;

  // Get counts per category using single groupBy query (avoids N+1)
  const blacklistConditions = withBlacklistFilter({});

  const counts = await prisma.tag.groupBy({
    by: ["category"],
    _count: { _all: true },
    where: blacklistConditions,
  });

  const result: TagsCategoryCounts = {
    ALL: 0,
    ARTIST: 0,
    COPYRIGHT: 0,
    CHARACTER: 0,
    GENERAL: 0,
    META: 0,
  };

  for (const item of counts) {
    result[item.category] = item._count._all;
    result.ALL += item._count._all;
  }

  tagsCategoryCountsCache.set("counts", result);
  return result;
}

export default async function TagsPage({ searchParams }: TagsPageProps) {
  const params = await searchParams;

  const query = params.q?.trim() || "";
  const categoryParam = params.category?.toUpperCase();
  const category =
    categoryParam && categoryParam !== "ALL" && Object.values(TagCategory).includes(categoryParam as TagCategory)
      ? (categoryParam as TagCategory)
      : null;
  const sort = (["count", "name", "-count", "-name"].includes(params.sort || "")
    ? params.sort
    : "count") as SortOption;
  const page = Math.max(1, parseInt(params.page || "1", 10));

  const [{ tags, totalCount, totalPages }, categoryCounts] = await Promise.all([
    getTags({ query, category, sort, page }),
    getCategoryCounts(),
  ]);

  const buildUrl = (overrides: { q?: string; category?: string; sort?: string; page?: number }) => {
    const newParams = new URLSearchParams();
    const newQuery = overrides.q !== undefined ? overrides.q : query;
    const newCategory = overrides.category !== undefined ? overrides.category : (category || "ALL");
    const newSort = overrides.sort !== undefined ? overrides.sort : sort;
    const newPage = overrides.page !== undefined ? overrides.page : 1;

    if (newQuery) newParams.set("q", newQuery);
    if (newCategory && newCategory !== "ALL") newParams.set("category", newCategory);
    if (newSort && newSort !== "count") newParams.set("sort", newSort);
    if (newPage > 1) newParams.set("page", String(newPage));

    const queryString = newParams.toString();
    return `/tags${queryString ? `?${queryString}` : ""}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tags</h1>
        <span className="text-sm text-zinc-400">
          {totalCount.toLocaleString()} {totalCount === 1 ? "tag" : "tags"}
          {query && " found"}
        </span>
      </div>

      {/* Search and filters */}
      <div className="space-y-4">
        {/* Search input */}
        <TagSearch initialQuery={query} />

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2">
          {CATEGORY_ORDER.map((cat) => {
            const isActive = cat === "ALL" ? !category : category === cat;
            const count = categoryCounts[cat];

            return (
              <Link
                key={cat}
                href={buildUrl({ category: cat, page: 1 })}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                }`}
              >
                {CATEGORY_LABELS[cat]}
                <span className="ml-1.5 text-xs opacity-70">
                  {count.toLocaleString()}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Sort options */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">Sort by:</span>
          <div className="flex gap-1">
            {[
              { value: "count", label: "Most used" },
              { value: "-count", label: "Least used" },
              { value: "name", label: "A-Z" },
              { value: "-name", label: "Z-A" },
            ].map((option) => (
              <Link
                key={option.value}
                href={buildUrl({ sort: option.value, page: 1 })}
                className={`rounded px-2 py-1 transition-colors ${
                  sort === option.value
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Top pagination */}
      {totalPages > 1 && (
        <Suspense fallback={null}>
          <Pagination currentPage={page} totalPages={totalPages} basePath="/tags" />
        </Suspense>
      )}

      {/* Tags grid */}
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Link
              key={tag.id}
              href={`/search?tags=${encodeURIComponent(tag.name)}`}
              className={`rounded-lg bg-zinc-800 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-700 ${CATEGORY_COLORS[tag.category as TagCategory]}`}
            >
              {tag.name.replace(/_/g, " ")}
              <span className="ml-1.5 text-zinc-500">{tag.count.toLocaleString()}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg bg-zinc-800 p-8 text-center">
          <p className="text-lg text-zinc-400">No tags found</p>
          {query && (
            <p className="mt-2 text-sm text-zinc-500">
              Try a different search term
            </p>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Suspense fallback={null}>
          <Pagination currentPage={page} totalPages={totalPages} basePath="/tags" />
        </Suspense>
      )}
    </div>
  );
}
