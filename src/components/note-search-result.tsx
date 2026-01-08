"use client";

import Link from "next/link";
import DOMPurify from "isomorphic-dompurify";

interface Post {
  id: number;
  hash: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  mimeType: string;
}

interface NoteSearchResultProps {
  note: {
    id: number;
    postId: number;
    name: string;
    content: string;
    contentHash: string;
    headline: string | null;
    posts: Post[];
  };
}

export function NoteSearchResult({ note }: NoteSearchResultProps) {
  const primaryPost = note.posts[0];
  const additionalPosts = note.posts.slice(1);
  const thumbnailUrl = `/api/thumbnails/${primaryPost.hash}.webp?size=grid`;
  const postUrl = `/post/${primaryPost.hash}`;
  const rawContent = note.headline || note.content.slice(0, 300);

  // Sanitize HTML to prevent XSS while preserving search highlight <mark> tags
  const displayContent = DOMPurify.sanitize(rawContent, {
    ALLOWED_TAGS: ["mark"],
    KEEP_CONTENT: true,
  });

  const isVideo = primaryPost.mimeType.startsWith("video/");
  const isAnimated = primaryPost.mimeType === "image/gif" || primaryPost.mimeType === "image/apng";

  return (
    <div className="group flex gap-4 rounded-lg bg-zinc-200 dark:bg-zinc-800 p-3 hover:bg-zinc-300/80 dark:hover:bg-zinc-700/80 transition-colors">
      {/* Thumbnails */}
      <div className="flex shrink-0 gap-1.5">
        {/* Primary thumbnail */}
        <Link href={postUrl} className="relative overflow-hidden rounded-md bg-zinc-300 dark:bg-zinc-700">
          <img
            src={thumbnailUrl}
            alt=""
            loading="lazy"
            className="h-32 w-auto"
            style={
              primaryPost.width && primaryPost.height
                ? { aspectRatio: `${primaryPost.width} / ${primaryPost.height}` }
                : { aspectRatio: "1" }
            }
          />
          {(isVideo || isAnimated) && (
            <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
              {isVideo ? "VIDEO" : "GIF"}
            </span>
          )}
        </Link>

        {/* Additional thumbnails strip */}
        {additionalPosts.length > 0 && (
          <div className="flex flex-col gap-1">
            {additionalPosts.slice(0, 3).map((post) => (
              <Link
                key={post.hash}
                href={`/post/${post.hash}`}
                className="relative overflow-hidden rounded bg-zinc-300 dark:bg-zinc-700 hover:ring-2 hover:ring-amber-500 transition-all"
              >
                <img
                  src={`/api/thumbnails/${post.hash}.webp?size=grid`}
                  alt=""
                  loading="lazy"
                  className="h-10 w-10 object-cover"
                />
                {post.mimeType.startsWith("video/") && (
                  <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-[8px] text-center text-white">
                    VID
                  </span>
                )}
              </Link>
            ))}
            {additionalPosts.length > 3 && (
              <div className="flex h-10 w-10 items-center justify-center rounded bg-zinc-400 dark:bg-zinc-600 text-xs text-zinc-600 dark:text-zinc-400">
                +{additionalPosts.length - 3}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Note content */}
      <Link href={postUrl} className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
            {note.name}
          </h3>
          <span className="shrink-0 text-xs text-zinc-500">
            {note.posts.length > 1 ? (
              <span className="text-amber-500">{note.posts.length} posts</span>
            ) : (
              primaryPost.hash.slice(0, 8)
            )}
          </span>
        </div>

        <div
          className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-4 [&_mark]:bg-amber-500/30 [&_mark]:text-amber-700 dark:[&_mark]:text-amber-200 [&_mark]:px-0.5 [&_mark]:rounded"
          dangerouslySetInnerHTML={{ __html: displayContent }}
        />

        {primaryPost.width && primaryPost.height && (
          <span className="text-xs text-zinc-500 mt-auto">
            {primaryPost.width}×{primaryPost.height}
          </span>
        )}
      </Link>
    </div>
  );
}