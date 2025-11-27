import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { TagSidebar } from "@/components/tag-sidebar";
import { MediaViewer } from "@/components/media-viewer";
import { FileDetails } from "@/components/post/file-details";
import { KeyboardNavigation } from "@/components/post/keyboard-navigation";
import { getCanonicalSourceUrl, getDisplaySources } from "@/lib/hydrus/url-parser";
import { SourceLink } from "@/components/source-link";
import { TagCategory } from "@/generated/prisma/enums";

interface PostPageProps {
  params: Promise<{ hash: string }>;
}

async function getPost(hash: string) {
  const post = await prisma.post.findUnique({
    where: { hash },
    include: {
      tags: {
        include: {
          tag: true,
        },
      },
      notes: {
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

  const tags = post.tags.map((pt) => pt.tag);

  // Get group info for related images
  const groups = post.groups.map((pg) => ({
    ...pg.group,
    currentPosition: pg.position,
  }));

  // Calculate prev/next posts from the first group with multiple posts
  let prevPostHash: string | undefined;
  let nextPostHash: string | undefined;

  for (const group of groups) {
    if (group.posts.length > 1) {
      const currentIndex = group.posts.findIndex((pg) => pg.post.hash === post.hash);
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
          mimeType={post.mimeType}
          prevPostHash={prevPostHash}
          nextPostHash={nextPostHash}
        />

        {/* Notes */}
        {post.notes.length > 0 && (
          <div className="rounded-lg bg-zinc-800 p-4">
            <h2 className="mb-3 text-lg font-semibold">Notes</h2>
            <div className="space-y-3">
              {post.notes.map((note) => (
                <div key={note.id} className="rounded bg-zinc-700/50 p-3">
                  <h3 className="mb-1 text-sm font-medium text-zinc-300">
                    {note.name}
                  </h3>
                  <p className="whitespace-pre-wrap text-sm">{note.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

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

          return (
            <div key={group.id} className="rounded-lg bg-zinc-800 p-4">
              <h2 className="mb-3 text-lg font-semibold">
                {group.sourceType} #{group.sourceId}
                <a
                  href={getCanonicalSourceUrl(group.sourceType, group.sourceId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-sm font-normal text-blue-400 hover:underline"
                >
                  View source
                </a>
              </h2>
              <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
                {group.posts.map((pg) => (
                  <Link
                    key={pg.post.hash}
                    href={`/post/${pg.post.hash}`}
                    className={`relative shrink-0 overflow-hidden rounded-lg bg-zinc-700 snap-start transition-transform hover:scale-[1.02] ${
                      pg.post.hash === post.hash
                        ? "ring-2 ring-blue-500"
                        : "hover:ring-2 hover:ring-blue-500"
                    }`}
                  >
                    <img
                      src={`/api/thumbnails/${pg.post.hash}`}
                      alt=""
                      className="h-24 w-auto"
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
              </div>
            </div>
          );
        })}

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
