import Link from "next/link";
import { redirect } from "next/navigation";
import { SourceType } from "@/generated/prisma/client";
import { getCanonicalSourceUrl } from "@/lib/hydrus/url-parser";
import { SourceBadge } from "@/components/source-badge";
import { searchGroups, OrderOption } from "@/lib/groups";

interface GroupsPageProps {
  searchParams: Promise<{ type?: string; page?: string; order?: string; seed?: string }>;
}

const SOURCE_TYPE_COLORS: Record<SourceType, string> = {
  [SourceType.PIXIV]: "bg-blue-500/20 text-blue-400",
  [SourceType.TWITTER]: "bg-sky-500/20 text-sky-400",
  [SourceType.DEVIANTART]: "bg-green-500/20 text-green-400",
  [SourceType.DANBOORU]: "bg-yellow-500/20 text-yellow-400",
  [SourceType.GELBOORU]: "bg-orange-500/20 text-orange-400",
  [SourceType.TITLE]: "bg-purple-500/20 text-purple-400",
  [SourceType.OTHER]: "bg-zinc-500/20 text-zinc-400",
};

const PAGE_SIZE = 50;

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
export default async function GroupsPage({ searchParams }: GroupsPageProps) {
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
        <span className="text-sm text-zinc-400">{totalGroups} total groups</span>
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
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
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
          <span className="text-sm text-zinc-400">Sort:</span>
          <div className="flex gap-1">
            {(["random", "newest", "oldest", "largest"] as const).map((o) => (
              <Link
                key={o}
                href={buildUrl({ order: o, page: 1, newSeed: o === "random" && order !== "random" })}
                className={`rounded px-2 py-1 text-sm transition-colors ${
                  order === o
                    ? "bg-zinc-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
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
              className="rounded bg-zinc-800 px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
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
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={buildUrl({ page: page - 1 })}
              className="rounded bg-zinc-800 px-3 py-1 text-sm hover:bg-zinc-700"
            >
              ← Prev
            </Link>
          )}
          <span className="text-sm text-zinc-400">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={buildUrl({ page: page + 1 })}
              className="rounded bg-zinc-800 px-3 py-1 text-sm hover:bg-zinc-700"
            >
              Next →
            </Link>
          )}
        </div>
      )}

      {/* Groups list */}
      <div className="space-y-4">
        {groupsWithPosts.map((mergedGroup) => {
          const postCount = mergedGroup.postCount;
          const primaryGroup = mergedGroup.groups[0];

          return (
            <div
              key={mergedGroup.contentHash}
              className="rounded-lg bg-zinc-800 p-4"
            >
              <div className="mb-3 flex flex-wrap items-center gap-3">
                {/* Show all source types for merged groups */}
                {mergedGroup.groups.map((g) => {
                  const canonicalUrl = getCanonicalSourceUrl(g.sourceType, g.sourceId);
                  return (
                    <div key={g.id} className="flex items-center gap-2">
                      <Link
                        href={`/groups/${g.id}`}
                        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                      >
                        <SourceBadge sourceType={g.sourceType} />
                        {g.sourceType !== SourceType.TITLE && (
                          <span className="font-mono text-sm text-zinc-400">
                            {g.sourceId}
                          </span>
                        )}
                      </Link>
                      {canonicalUrl && (
                        <a
                          href={canonicalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300"
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
                <span className="text-sm text-zinc-500">
                  {postCount} posts
                </span>
              </div>

              {/* Post thumbnails - horizontal filmstrip */}
              <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
                {mergedGroup.posts.map((pg) => (
                  <Link
                    key={pg.post.hash}
                    href={`/post/${pg.post.hash}`}
                    className="relative shrink-0 overflow-hidden rounded-lg bg-zinc-700 snap-start transition-transform hover:scale-[1.02] hover:ring-2 hover:ring-blue-500"
                  >
                    <img
                      src={`/api/thumbnails/${pg.post.hash}.webp`}
                      alt=""
                      loading="lazy"
                      className="h-48 w-auto"
                      style={
                        pg.post.width && pg.post.height
                          ? { aspectRatio: `${pg.post.width} / ${pg.post.height}` }
                          : { aspectRatio: "1" }
                      }
                    />
                    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
                      {pg.position || "?"}
                    </span>
                  </Link>
                ))}
                {postCount > 10 && (
                  <Link
                    href={`/groups/${primaryGroup.id}`}
                    className="flex h-48 w-24 shrink-0 items-center justify-center rounded-lg bg-zinc-700 text-sm font-medium text-zinc-400 hover:bg-zinc-600 transition-colors"
                  >
                    +{postCount - 10}
                  </Link>
                )}
              </div>
            </div>
          );
        })}

        {groupsWithPosts.length === 0 && (
          <div className="rounded-lg bg-zinc-800 p-8 text-center text-zinc-400">
            No groups found
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={buildUrl({ page: page - 1 })}
              className="rounded bg-zinc-800 px-3 py-1 text-sm hover:bg-zinc-700"
            >
              ← Prev
            </Link>
          )}
          <span className="text-sm text-zinc-400">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={buildUrl({ page: page + 1 })}
              className="rounded bg-zinc-800 px-3 py-1 text-sm hover:bg-zinc-700"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}