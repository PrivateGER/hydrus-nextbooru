import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { TagSidebar } from "@/components/tag-sidebar";
import { MediaViewer } from "@/components/media-viewer";
import { FileDetails } from "@/components/post/file-details";
import { KeyboardNavigation } from "@/components/post/keyboard-navigation";
import { getCanonicalSourceUrl, getDisplaySources } from "@/lib/hydrus/url-parser";
import { SourceLink } from "@/components/source-link";
import { SourceBadge } from "@/components/source-badge";
import { TagCategory } from "@/generated/prisma/enums";
import { filterBlacklistedTags, withPostHidingFilter } from "@/lib/tag-blacklist";
import { NoteCard } from "@/components/note-card";
import { TranslateImageButton } from "@/components/translate-image-button";
import { RelatedPosts, RelatedPostsSkeleton } from "@/components/post/related-posts";
import { GroupFilmstrip } from "@/components/post/group-filmstrip";

interface PostPageProps {
  params: Promise<{ hash: string }>;
}

async function getPost(hash: string) {
  // Use withPostHidingFilter to ensure hidden posts return null
  const post = await prisma.post.findFirst({
    where: withPostHidingFilter({ hash }),
    include: {
      tags: {
        include: {
          tag: true,
        },
      },
      notes: {
        include: { translation: true },
        orderBy: { name: "asc" },
      },
      groups: {
        include: {
          group: {
            include: {
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
          },
        },
      },
    },
  });

  return post;
}

/**
 * Render the post detail page for a given post hash.
 *
 * Validates the provided hash and loads the post from the database; if the hash is malformed
 * or the post cannot be found, the route will trigger a notFound response. The rendered page
 * includes the media viewer, tag sidebar, notes list (with NoteCard), an image translation button,
 * source links, file details (with a generated download filename), related-image filmstrips for groups,
 * and keyboard/prev-next navigation when available.
 *
 * @param params - An object (awaitable) that resolves to route parameters containing `hash`, the 64-character post identifier.
 * @returns The React element representing the post detail page.
 */
export default async function PostPage({ params }: PostPageProps) {
  const { hash } = await params;

  // Validate hash format (64 hex characters)
  if (!/^[a-fA-F0-9]{64}$/i.test(hash)) {
    notFound();
  }

  const post = await getPost(hash.toLowerCase());

  if (!post) {
    notFound();
  }

  const tags = filterBlacklistedTags(post.tags.map((pt) => pt.tag));

  // Get group info for related images
  const groups = post.groups.map((pg) => ({
    ...pg.group,
    currentPosition: pg.position,
  }));

  // Calculate prev/next posts from the first group with multiple posts
  let prevPostHash: string | undefined;
  let nextPostHash: string | undefined;
  let currentPosition: number | undefined;
  let totalCount: number | undefined;

  for (const group of groups) {
    if (group.posts.length > 1) {
      const currentIndex = group.posts.findIndex((pg) => pg.post.hash === post.hash);
      currentPosition = currentIndex + 1; // 1-based position
      totalCount = group.posts.length;
      if (currentIndex > 0) {
        prevPostHash = group.posts[currentIndex - 1].post.hash;
      }
      if (currentIndex < group.posts.length - 1) {
        nextPostHash = group.posts[currentIndex + 1].post.hash;
      }
      break; // Use only the first group with multiple posts
    }
  }

  // Build download filename: artist_character_hash_pagenum.ext
  const sanitize = (str: string) =>
    str
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 30);

  // Prefer artist tags that aren't purely numeric (IDs)
  const artistTags = tags.filter((t) => t.category === TagCategory.ARTIST);
  const artistTag =
    artistTags.find((t) => !/^\d+$/.test(t.name))?.name ||
    artistTags[0]?.name;

  // Get first character tag
  const characterTag = tags.find((t) => t.category === TagCategory.CHARACTER)?.name;

  // Get page number from first group (if in a multi-post group)
  const pageNum = groups.find((g) => g.posts.length > 1)?.currentPosition;

  const downloadFilename = [
    artistTag && sanitize(artistTag),
    characterTag && sanitize(characterTag),
    post.hash.slice(0, 8),
    pageNum !== undefined && `p${pageNum}`,
  ]
    .filter(Boolean)
    .join("_") + `.${post.extension}`;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Keyboard navigation handler */}
      <KeyboardNavigation
        prevPostHash={prevPostHash}
        nextPostHash={nextPostHash}
      />

      {/* Sidebar - Tags (appears below content on mobile, left on desktop) */}
      <div className="order-last lg:order-first">
        <TagSidebar tags={tags} />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Media viewer */}
        <MediaViewer
          hash={post.hash}
          extension={post.extension}
          mimeType={post.mimeType}
          width={post.width}
          height={post.height}
          blurhash={post.blurhash}
          prevPostHash={prevPostHash}
          nextPostHash={nextPostHash}
          currentPosition={currentPosition}
          totalCount={totalCount}
        />

        {/* Notes */}
        {post.notes.length > 0 && (
          <div className="rounded-lg bg-zinc-800 p-4">
            <h2 className="mb-3 text-lg font-semibold">Notes</h2>
            <div className="space-y-3">
              {post.notes.map((note) => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          </div>
        )}

        {/* Translate Image */}
        <TranslateImageButton
          hash={post.hash}
          mimeType={post.mimeType}
          existingTranslation={
            post.imageTranslatedText
              ? {
                  translatedText: post.imageTranslatedText,
                  sourceLanguage: post.imageSourceLanguage,
                  targetLanguage: post.imageTargetLanguage,
                }
              : null
          }
        />

        {/* Source URLs */}
        {(() => {
          const sources = getDisplaySources(post.sourceUrls);
          if (sources.length === 0) return null;
          return (
            <div className="rounded-lg bg-zinc-800 p-4">
              <h2 className="mb-3 text-lg font-semibold">Sources</h2>
              <ul className="space-y-2 text-sm">
                {sources.map((source, i) => (
                  <li key={i}>
                    <SourceLink source={source} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}

        {/* File details */}
        <FileDetails
          hash={post.hash}
          extension={post.extension}
          mimeType={post.mimeType}
          width={post.width}
          height={post.height}
          fileSize={post.fileSize}
          duration={post.duration}
          hasAudio={post.hasAudio}
          importedAt={post.importedAt}
          downloadFilename={downloadFilename}
        />

        {/* Related images from groups - horizontal filmstrip */}
        {groups.map((group) => {
          if (group.posts.length <= 1) return null;

          const sourceUrl = getCanonicalSourceUrl(group.sourceType, group.sourceId);

          return (
            <div key={group.id} className="rounded-lg bg-zinc-800 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Link href={`/groups/${group.id}`} className="hover:opacity-80 transition-opacity">
                  <SourceBadge sourceType={group.sourceType} />
                </Link>
                {sourceUrl ? (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:underline"
                  >
                    View source
                  </a>
                ) : group.sourceType === "TITLE" ? (
                  <Link
                    href={`/groups/${group.id}`}
                    className="text-sm text-zinc-300 truncate max-w-xs hover:text-white transition-colors"
                    title={group.sourceId}
                  >
                    {group.sourceId}
                  </Link>
                ) : null}
                <Link
                  href={`/groups/${group.id}`}
                  className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {group.posts.length} images
                </Link>
              </div>
              <GroupFilmstrip posts={group.posts} currentHash={post.hash} />
            </div>
          );
        })}

        {/* Similar posts based on tag similarity */}
        <Suspense fallback={<RelatedPostsSkeleton />}>
          <RelatedPosts hash={post.hash} />
        </Suspense>

        {/* Navigation */}
        <div className="flex items-center justify-between text-sm">
          <Link href="/" className="text-blue-400 hover:underline">
            &larr; Back to gallery
          </Link>
          <div className="flex items-center gap-4 text-zinc-500">
            {prevPostHash && (
              <Link href={`/post/${prevPostHash}`} className="hover:text-zinc-300">
                &larr; Prev
              </Link>
            )}
            {nextPostHash && (
              <Link href={`/post/${nextPostHash}`} className="hover:text-zinc-300">
                Next &rarr;
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}