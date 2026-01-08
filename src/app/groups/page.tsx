import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SourceType } from "@/generated/prisma/client";

import { getCanonicalSourceUrl } from "@/lib/hydrus/url-parser";
import { Pagination } from "@/components/pagination";
import { SourceBadge } from "@/components/source-badge";
import { PageHeaderSkeleton, FiltersSkeleton, GroupCardSkeleton } from "@/components/skeletons";
import { searchGroups, OrderOption } from "@/lib/groups";

export const metadata: Metadata = {
  title: "Groups - Booru",
  description: "Browse grouped posts by source",
};

interface GroupsPageProps {
  searchParams: Promise<{ type?: string; page?: string; order?: string; seed?: string }>;
}

function GroupsPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading groups">
      <PageHeaderSkeleton />
      <div className="flex flex-wrap items-center gap-4">
        <FiltersSkeleton count={5} />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <GroupCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

const SOURCE_TYPE_COLORS: Record<SourceType, string> = {
  [SourceType.PIXIV]: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
  [SourceType.TWITTER]: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400",
  [SourceType.DEVIANTART]: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400",
  [SourceType.DANBOORU]: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400",
  [SourceType.GELBOORU]: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400",
  [SourceType.TITLE]: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400",
  [SourceType.OTHER]: "bg-zinc-200 text-zinc-600 dark:bg-zinc-500/20 dark:text-zinc-400",
};

const PAGE_SIZE = 50;

async function GroupsPageContent({ searchParams }: { searchParams: Promise<{ type?: string; page?: string; order?: string; seed?: string }> }) {
  const params = await searchParams;
  const typeFilter = params.type as SourceType | undefined;
  const order = (params.order as OrderOption) || "random";
  const page = Math.max(1, parseInt(params.page || "1", 10));

  // Redirect to include seed for stable random ordering across pagination
  if (order === "random" && !params.seed) {
    const newSeed = Math.random().toString(36).substring(2, 10);
    const redirectParams = new URLSearchParams();
    if (typeFilter) redirectParams.set("type", typeFilter);
    redirectParams.set("order", "random");
    if (page > 1) redirectParams.set("page", page.toString());
    redirectParams.set("seed", newSeed);
    redirect(`/groups?${redirectParams.toString()}`);
  }

  const seed = params.seed || "";

  // Fetch groups data using the extracted module
  const {
    groups: groupsWithPosts,
    typeCounts,
    totalGroups,
    totalPages,
  } = await searchGroups({
    typeFilter,
    order,
    page,
    pageSize: PAGE_SIZE,
    seed,
  });

  // Build URL helper for maintaining state across navigation
  const buildUrl = (overrides: { type?: string | null; order?: string; page?: number; newSeed?: boolean }) => {
    const params = new URLSearchParams();
    const newType = overrides.type === null ? undefined : (overrides.type ?? typeFilter);
    const newOrder = overrides.order ?? order;
    const newPage = overrides.page ?? page;
    const newSeed = overrides.newSeed ? Math.random().toString(36).substring(2, 10) : seed;

    if (newType) params.set("type", newType);
    params.set("order", newOrder);
    if (newPage > 1) params.set("page", newPage.toString());
    if (newOrder === "random") params.set("seed", newSeed);

    const queryString = params.toString();
    return `/groups${queryString ? `?${queryString}` : ""}`;
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Groups</h1>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">{totalGroups} total groups</span>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Type filters */}
        <div className="flex flex-wrap gap-2">
          <Link
            href={buildUrl({ type: null, page: 1 })}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              !typeFilter
                ? "bg-blue-500 text-white"
                : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            All
          </Link>
          {typeCounts.map(({ sourceType, count }) => (
            <Link
              key={sourceType}
              href={buildUrl({ type: sourceType, page: 1 })}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                typeFilter === sourceType
                  ? "bg-blue-500 text-white"
                  : `${SOURCE_TYPE_COLORS[sourceType]} hover:opacity-80`
              }`}
            >
              {sourceType} ({count})
            </Link>
          ))}
        </div>

        {/* Order selector */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">Sort:</span>
          <div className="flex gap-1">
            {(["random", "newest", "oldest", "largest"] as const).map((o) => (
              <Link
                key={o}
                href={buildUrl({ order: o, page: 1, newSeed: o === "random" && order !== "random" })}
                className={`rounded px-2 py-1 text-sm transition-colors ${
                  order === o
                    ? "bg-zinc-300 text-zinc-900 dark:bg-zinc-600 dark:text-white"
                    : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
              >
                {o.charAt(0).toUpperCase() + o.slice(1)}
              </Link>
            ))}
          </div>
          {/* Re-roll button for random order */}
          {order === "random" && (
            <Link
              href={buildUrl({ page: 1, newSeed: true })}
              className="rounded bg-zinc-200 px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-300 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-white transition-colors"
              title="Shuffle"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </Link>
          )}
        </div>
      </div>

      {/* Top pagination */}
      <Pagination currentPage={page} totalPages={totalPages} />

      {/* Groups list */}
      <div className="space-y-4">
        {groupsWithPosts.map((mergedGroup) => {
          const postCount = mergedGroup.postCount;
          const primaryGroup = mergedGroup.groups[0];

          return (
            <div
              key={mergedGroup.contentHash}
              className="group/card rounded-xl bg-white p-4 transition-all duration-200 hover:bg-zinc-50 hover:shadow-lg hover:shadow-black/10 border border-zinc-200 hover:border-zinc-300 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 dark:hover:shadow-black/20 dark:border-zinc-700/50 dark:hover:border-zinc-600/50"
            >
              {/* Header with sources and post count */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Show all source types for merged groups */}
                  {mergedGroup.groups.map((g) => {
                    const canonicalUrl = getCanonicalSourceUrl(g.sourceType, g.sourceId);
                    const isTitleGroup = g.sourceType === SourceType.TITLE && g.title;
                    const displayTitle = g.translatedTitle || g.title;
                    return (
                      <div key={g.id} className="flex items-center gap-2">
                        <Link
                          href={`/groups/${g.id}`}
                          className="flex items-center gap-2 rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700/50"
                        >
                          <SourceBadge sourceType={g.sourceType} />
                          {isTitleGroup ? (
                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200 max-w-xs truncate" title={displayTitle!}>
                              {displayTitle}
                            </span>
                          ) : g.sourceType !== SourceType.TITLE && (
                            <span className="font-mono text-sm text-zinc-500 dark:text-zinc-400">
                              {g.sourceId}
                            </span>
                          )}
                        </Link>
                        {canonicalUrl && (
                          <a
                            href={canonicalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-blue-600 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-blue-400"
                            title="View source"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Post count and creators */}
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-200 px-3 py-1 text-sm font-medium text-zinc-700 dark:bg-zinc-700/80 dark:text-zinc-300">
                    <svg className="h-4 w-4 text-zinc-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {postCount}
                  </span>
                  {mergedGroup.creators.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                      <svg className="h-4 w-4 text-zinc-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {mergedGroup.creators.map((creator, i) => (
                        <span key={creator}>
                          <Link
                            href={`/search?tags=${encodeURIComponent(creator)}`}
                            className="hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                          >
                            {creator}
                          </Link>
                          {i < mergedGroup.creators.length - 1 && ", "}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </div>

              {/* Post thumbnails - horizontal filmstrip */}
              <div className="flex gap-2 overflow-x-auto pb-2 snap-x scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-600 scrollbar-track-transparent">
                {mergedGroup.posts.map((pg, index) => (
                  <Link
                    key={pg.post.hash}
                    href={`/post/${pg.post.hash}`}
                    className="relative shrink-0 overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-700 snap-start transition-all duration-200 hover:scale-[1.03] hover:ring-2 hover:ring-blue-500 hover:shadow-md hover:shadow-black/20 dark:hover:shadow-black/30"
                  >
                    <img
                      src={`/api/thumbnails/${pg.post.hash}.webp`}
                      alt=""
                      loading="lazy"
                      className="h-44 w-auto object-cover"
                      style={
                        pg.post.width && pg.post.height
                          ? { aspectRatio: `${pg.post.width} / ${pg.post.height}` }
                          : { aspectRatio: "1" }
                      }
                    />
                    {/* Position badge */}
                    <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/60 dark:bg-black/75 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
                      {pg.position ?? index + 1}
                    </span>
                  </Link>
                ))}
                {postCount > 10 && (
                  <Link
                    href={`/groups/${primaryGroup.id}`}
                    className="flex h-44 w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-lg bg-zinc-200 text-zinc-500 dark:bg-zinc-700/80 dark:text-zinc-400 transition-all duration-200 hover:bg-zinc-300 hover:text-zinc-700 dark:hover:bg-zinc-600 dark:hover:text-zinc-200"
                  >
                    <span className="text-2xl font-bold">+{postCount - 10}</span>
                    <span className="text-xs">more</span>
                  </Link>
                )}
              </div>
            </div>
          );
        })}

        {groupsWithPosts.length === 0 && (
          <div className="rounded-lg bg-white border border-zinc-200 p-8 text-center text-zinc-500 dark:bg-zinc-800 dark:border-transparent dark:text-zinc-400">
            No groups found
          </div>
        )}
      </div>

      {/* Pagination */}
      <Pagination currentPage={page} totalPages={totalPages} />
    </div>
  );
}

/**
 * Render the Groups listing page with filters, ordering, thumbnails, and pagination.
 *
 * When the selected order is "random" and no `seed` is supplied, redirects to a URL that
 * includes a generated seed so random ordering remains stable across pagination.
 *
 * @param searchParams - A promise resolving to query parameters `{ type?, page?, order?, seed? }`
 *   where `type` filters by source type, `page` selects the pagination page, `order` selects
 *   the sort mode (`"random" | "newest" | "oldest" | "largest"`), and `seed` stabilizes random order.
 * @returns A React element containing the groups listing UI.
 */
export default function GroupsPage({ searchParams }: GroupsPageProps) {
  return (
    <Suspense fallback={<GroupsPageSkeleton />}>
      <GroupsPageContent searchParams={searchParams} />
    </Suspense>
  );
}