import Link from "next/link";
import { prisma } from "@/lib/db";
import { SourceType, Prisma } from "@/generated/prisma/client";
import { getCanonicalSourceUrl } from "@/lib/hydrus/url-parser";

interface GroupsPageProps {
  searchParams: Promise<{ type?: string; page?: string }>;
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

export default async function GroupsPage({ searchParams }: GroupsPageProps) {
  const params = await searchParams;
  const typeFilter = params.type as SourceType | undefined;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  // Get counts by source type (only groups with 2+ members)
  const typeCountsRaw = await prisma.$queryRaw<{ sourceType: string; count: bigint }[]>`
    SELECT g."sourceType", COUNT(*)::bigint as count
    FROM "Group" g
    WHERE (SELECT COUNT(*) FROM "PostGroup" pg WHERE pg."groupId" = g.id) >= 2
    GROUP BY g."sourceType"
    ORDER BY count DESC
  `;

  const typeCounts = typeCountsRaw.map(r => ({
    sourceType: r.sourceType as SourceType,
    _count: { id: Number(r.count) },
  }));

  const totalGroups = typeCounts.reduce((sum, t) => sum + t._count.id, 0);

  // Get groups with 2+ posts
  const groups = await prisma.$queryRaw<{ id: number; sourceType: string; sourceId: string; postCount: bigint }[]>`
    SELECT g.id, g."sourceType", g."sourceId", COUNT(pg."postId")::bigint as "postCount"
    FROM "Group" g
    JOIN "PostGroup" pg ON pg."groupId" = g.id
    ${typeFilter ? Prisma.sql`WHERE g."sourceType" = ${typeFilter}::"SourceType"` : Prisma.empty}
    GROUP BY g.id
    HAVING COUNT(pg."postId") >= 2
    ORDER BY g.id DESC
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `;

  // Fetch posts for each group
  const groupIds = groups.map(g => g.id);
  const groupPosts = groupIds.length > 0 ? await prisma.postGroup.findMany({
    where: { groupId: { in: groupIds } },
    include: {
      post: {
        select: {
          hash: true,
          width: true,
          height: true,
        },
      },
    },
    orderBy: { position: "asc" },
  }) : [];

  // Group posts by groupId
  const postsByGroup = new Map<number, typeof groupPosts>();
  for (const pg of groupPosts) {
    const existing = postsByGroup.get(pg.groupId) || [];
    existing.push(pg);
    postsByGroup.set(pg.groupId, existing);
  }

  // Combine data
  const groupsWithPosts = groups.map(g => ({
    id: g.id,
    sourceType: g.sourceType as SourceType,
    sourceId: g.sourceId,
    _count: { posts: Number(g.postCount) },
    posts: (postsByGroup.get(g.id) || []).slice(0, 10),
  }));

  // Count total groups with 2+ posts
  const [{ count: filteredCount }] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint as count FROM (
      SELECT g.id FROM "Group" g
      JOIN "PostGroup" pg ON pg."groupId" = g.id
      ${typeFilter ? Prisma.sql`WHERE g."sourceType" = ${typeFilter}::"SourceType"` : Prisma.empty}
      GROUP BY g.id
      HAVING COUNT(pg."postId") >= 2
    ) sub
  `;

  const totalPages = Math.ceil(Number(filteredCount) / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Groups</h1>
        <span className="text-sm text-zinc-400">{totalGroups} total groups</span>
      </div>

      {/* Type filters */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/groups"
          className={`rounded-full px-3 py-1 text-sm transition-colors ${
            !typeFilter
              ? "bg-blue-500 text-white"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          All
        </Link>
        {typeCounts.map(({ sourceType, _count }) => (
          <Link
            key={sourceType}
            href={`/groups?type=${sourceType}`}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              typeFilter === sourceType
                ? "bg-blue-500 text-white"
                : `${SOURCE_TYPE_COLORS[sourceType]} hover:opacity-80`
            }`}
          >
            {sourceType} ({_count.id})
          </Link>
        ))}
      </div>

      {/* Groups list */}
      <div className="space-y-4">
        {groupsWithPosts.map((group) => {
          const postCount = group._count.posts;
          const canonicalUrl = getCanonicalSourceUrl(group.sourceType, group.sourceId);

          return (
            <div
              key={group.id}
              className="rounded-lg bg-zinc-800 p-4"
            >
              <div className="mb-3 flex items-center gap-3">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${SOURCE_TYPE_COLORS[group.sourceType]}`}
                >
                  {group.sourceType}
                </span>
                <span className="font-mono text-sm text-zinc-400">
                  {group.sourceType === SourceType.TITLE
                    ? `#${group.sourceId}`
                    : group.sourceId}
                </span>
                <span className="text-sm text-zinc-500">
                  {postCount} posts
                </span>
                {canonicalUrl && (
                  <a
                    href={canonicalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:underline"
                  >
                    View source ↗
                  </a>
                )}
              </div>

              {/* Post thumbnails - horizontal filmstrip */}
              <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
                {group.posts.map((pg) => (
                  <Link
                    key={pg.post.hash}
                    href={`/post/${pg.post.hash}`}
                    className="relative shrink-0 overflow-hidden rounded-lg bg-zinc-700 snap-start transition-transform hover:scale-[1.02] hover:ring-2 hover:ring-blue-500"
                  >
                    <img
                      src={`/api/thumbnails/${pg.post.hash}`}
                      alt=""
                      className="h-48 w-auto"
                      style={
                        pg.post.width && pg.post.height
                          ? { aspectRatio: `${pg.post.width} / ${pg.post.height}` }
                          : { aspectRatio: "1" }
                      }
                    />
                    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
                      {pg.position}
                    </span>
                  </Link>
                ))}
                {postCount > 10 && (
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-zinc-700 text-sm font-medium text-zinc-400">
                    +{postCount - 10}
                  </div>
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
              href={`/groups?${typeFilter ? `type=${typeFilter}&` : ""}page=${page - 1}`}
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
              href={`/groups?${typeFilter ? `type=${typeFilter}&` : ""}page=${page + 1}`}
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
