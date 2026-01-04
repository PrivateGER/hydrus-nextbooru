import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCanonicalSourceUrl } from "@/lib/hydrus/url-parser";
import { isValidCreatorName } from "@/lib/groups";
import { SourceBadge } from "@/components/source-badge";
import { PostCard } from "@/components/post-card";
import { TranslateTitleButton } from "@/components/translate-title-button";
import { SourceType, TagCategory } from "@/generated/prisma/client";
import {
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
  PhotoIcon,
  UserIcon,
} from "@heroicons/react/24/outline";

interface GroupPageProps {
  params: Promise<{ id: string }>;
}

async function getGroup(id: number) {
  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      translation: true,
      posts: {
        include: {
          post: {
            select: {
              id: true,
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

async function getGroupCreators(postIds: number[]): Promise<string[]> {
  if (postIds.length === 0) return [];

  const artistTags = await prisma.tag.findMany({
    where: {
      category: TagCategory.ARTIST,
      posts: {
        some: {
          postId: { in: postIds },
        },
      },
    },
    select: { name: true },
    orderBy: { postCount: "desc" },
    take: 10, // Fetch more to account for filtering
  });

  return artistTags
    .map((t) => t.name)
    .filter(isValidCreatorName)
    .slice(0, 5);
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

  const postIds = group.posts.map((pg) => pg.post.id);
  const creators = await getGroupCreators(postIds);
  const canonicalUrl = getCanonicalSourceUrl(group.sourceType, group.sourceId);

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-xl bg-zinc-800/80 border border-zinc-700/50 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Left section: Back button, source badge, and title */}
          <div className="flex items-center gap-4">
            <Link
              href="/groups"
              className="flex items-center justify-center h-10 w-10 rounded-lg bg-zinc-700/50 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
              aria-label="Back to groups"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <SourceBadge sourceType={group.sourceType} />
                {group.sourceType === SourceType.TITLE ? (
                  <div className="flex flex-col">
                    <h1
                      className="text-lg font-bold truncate max-w-md"
                      title={group.translation?.translatedContent || group.title || group.sourceId}
                    >
                      {group.translation?.translatedContent || group.title || group.sourceId}
                    </h1>
                    {group.title && (
                      <TranslateTitleButton
                        groupId={group.id}
                        title={group.title}
                        existingTranslation={group.translation ? {
                          translatedTitle: group.translation.translatedContent,
                          sourceLanguage: group.translation.sourceLanguage,
                          targetLanguage: group.translation.targetLanguage,
                        } : null}
                      />
                    )}
                  </div>
                ) : (
                  <span className="font-mono text-sm text-zinc-400">{group.sourceId}</span>
                )}
              </div>
              {/* Image count and creator */}
              <div className="flex items-center gap-3 text-sm text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <PhotoIcon className="h-4 w-4" />
                  <span>{group.posts.length} images</span>
                </div>
                {creators.length > 0 && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <div className="flex items-center gap-1.5">
                      <UserIcon className="h-4 w-4" />
                      <span className="flex items-center gap-1">
                        {creators.map((creator, i) => (
                          <span key={creator}>
                            <Link
                              href={`/search?tags=${encodeURIComponent(creator)}`}
                              className="text-zinc-400 hover:text-zinc-200 transition-colors"
                            >
                              {creator}
                            </Link>
                            {i < creators.length - 1 && <span className="text-zinc-600">, </span>}
                          </span>
                        ))}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right section: View source link */}
          {canonicalUrl && (
            <a
              href={canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
            >
              View source
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      {/* Posts grid - uniform layout */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {group.posts.map((pg, index) => (
          <div key={pg.post.hash} className="group/post relative">
            <PostCard
              hash={pg.post.hash}
              width={pg.post.width}
              height={pg.post.height}
              blurhash={pg.post.blurhash}
              mimeType={pg.post.mimeType}
              layout="grid"
            />
            {/* Position indicator - enhanced styling */}
            <span className="absolute top-2 left-2 rounded-md bg-black/80 px-2 py-1 text-xs font-bold text-white pointer-events-none z-10 backdrop-blur-sm shadow-sm">
              {pg.position ?? index + 1}
            </span>
          </div>
        ))}
      </div>

      {group.posts.length === 0 && (
        <div className="rounded-xl bg-zinc-800/80 border border-zinc-700/50 p-12 text-center">
          <PhotoIcon className="mx-auto h-12 w-12 text-zinc-600" />
          <p className="mt-3 text-zinc-400">No images in this group</p>
        </div>
      )}
    </div>
  );
}
