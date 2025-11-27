import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCanonicalSourceUrl } from "@/lib/hydrus/url-parser";
import { SourceBadge } from "@/components/source-badge";
import { PostCard } from "@/components/post-card";
import { SourceType } from "@/generated/prisma/client";

interface GroupPageProps {
  params: Promise<{ id: string }>;
}

async function getGroup(id: number) {
  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      posts: {
        include: {
          post: {
            select: {
              hash: true,
              width: true,
              height: true,
              blurhash: true,
              mimeType: true,
            },
          },
        },
        orderBy: { position: "asc" },
      },
    },
  });

  return group;
}

export default async function GroupPage({ params }: GroupPageProps) {
  const { id } = await params;
  const groupId = parseInt(id, 10);

  if (isNaN(groupId)) {
    notFound();
  }

  const group = await getGroup(groupId);

  if (!group) {
    notFound();
  }

  const canonicalUrl = getCanonicalSourceUrl(group.sourceType, group.sourceId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/groups"
            className="text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </Link>
          <SourceBadge sourceType={group.sourceType} />
          {group.sourceType === SourceType.TITLE ? (
            <h1 className="text-xl font-bold truncate max-w-md" title={group.sourceId}>
              {group.sourceId}
            </h1>
          ) : (
            <span className="font-mono text-zinc-400">{group.sourceId}</span>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-zinc-400">
          <span>{group.posts.length} images</span>
          {canonicalUrl && (
            <a
              href={canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-400 hover:underline"
            >
              View source
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          )}
        </div>
      </div>

      {/* Posts grid - uniform layout */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {group.posts.map((pg) => (
          <div key={pg.post.hash} className="relative">
            <PostCard
              hash={pg.post.hash}
              width={pg.post.width}
              height={pg.post.height}
              blurhash={pg.post.blurhash}
              mimeType={pg.post.mimeType}
              layout="grid"
            />
            {/* Position indicator */}
            <span className="absolute top-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white pointer-events-none z-10">
              {pg.position || "?"}
            </span>
          </div>
        ))}
      </div>

      {group.posts.length === 0 && (
        <div className="rounded-lg bg-zinc-800 p-8 text-center text-zinc-400">
          No images in this group
        </div>
      )}
    </div>
  );
}
