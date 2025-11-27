import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { TagSidebar } from "@/components/tag-sidebar";
import { MediaViewer } from "@/components/media-viewer";
import { getCanonicalSourceUrl } from "@/lib/hydrus/url-parser";

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

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format duration
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex gap-6">
      {/* Left sidebar - Tags */}
      <TagSidebar tags={tags} />

      {/* Main content */}
      <div className="flex-1 space-y-6">
        {/* Media viewer */}
        <MediaViewer
          hash={post.hash}
          mimeType={post.mimeType}
          prevPostHash={prevPostHash}
          nextPostHash={nextPostHash}
        />

        {/* File info */}
        <div className="rounded-lg bg-zinc-800 p-4">
          <h2 className="mb-3 text-lg font-semibold">File Information</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-zinc-400">Size</dt>
              <dd>{formatFileSize(post.fileSize)}</dd>
            </div>
            {post.width && post.height && (
              <div>
                <dt className="text-zinc-400">Dimensions</dt>
                <dd>
                  {post.width} x {post.height}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-zinc-400">Type</dt>
              <dd>{post.mimeType}</dd>
            </div>
            {post.duration && (
              <div>
                <dt className="text-zinc-400">Duration</dt>
                <dd>{formatDuration(post.duration)}</dd>
              </div>
            )}
            <div>
              <dt className="text-zinc-400">Imported</dt>
              <dd>{post.importedAt.toLocaleDateString()}</dd>
            </div>
            {post.hasAudio && (
              <div>
                <dt className="text-zinc-400">Audio</dt>
                <dd>Yes</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Source URLs */}
        {post.sourceUrls.length > 0 && (
          <div className="rounded-lg bg-zinc-800 p-4">
            <h2 className="mb-3 text-lg font-semibold">Sources</h2>
            <ul className="space-y-1 text-sm">
              {post.sourceUrls.map((url, i) => (
                <li key={i}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 hover:underline"
                  >
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

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

        {/* Related images from groups */}
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
              <div className="columns-3 gap-2 sm:columns-4 md:columns-5 lg:columns-6">
                {group.posts.map((pg) => (
                  <Link
                    key={pg.post.hash}
                    href={`/post/${pg.post.hash}`}
                    className={`relative mb-2 block overflow-hidden rounded-lg bg-zinc-700 break-inside-avoid transition-transform hover:scale-[1.02] ${
                      pg.post.hash === post.hash
                        ? "ring-2 ring-blue-500"
                        : "hover:ring-2 hover:ring-blue-500"
                    }`}
                  >
                    <img
                      src={`/api/thumbnails/${pg.post.hash}`}
                      alt=""
                      className="w-full h-auto"
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
        <div className="flex justify-between text-sm">
          <Link href="/" className="text-blue-400 hover:underline">
            &larr; Back to gallery
          </Link>
          <span className="text-zinc-500">{post.hash.substring(0, 12)}...</span>
        </div>
      </div>
    </div>
  );
}
