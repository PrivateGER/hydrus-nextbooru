"use client";

import Link from "next/link";

interface NoteSearchResultProps {
  note: {
    id: number;
    postId: number;
    name: string;
    content: string;
    headline: string | null;
    post: {
      id: number;
      hash: string;
      width: number | null;
      height: number | null;
      blurhash: string | null;
      mimeType: string;
    };
  };
}

export function NoteSearchResult({ note }: NoteSearchResultProps) {
  const thumbnailUrl = `/api/thumbnails/${note.post.hash}.webp?size=grid`;
  const postUrl = `/post/${note.post.hash}`;
  const displayContent = note.headline || note.content.slice(0, 300);

  const isVideo = note.post.mimeType.startsWith("video/");
  const isAnimated = note.post.mimeType === "image/gif" || note.post.mimeType === "image/apng";

  return (
    <Link
      href={postUrl}
      className="group flex gap-4 rounded-lg bg-zinc-800 p-3 hover:bg-zinc-700/80 transition-colors"
    >
      {/* Thumbnail */}
      <div className="relative shrink-0 overflow-hidden rounded-md bg-zinc-700">
        <img
          src={thumbnailUrl}
          alt=""
          loading="lazy"
          className="h-32 w-auto"
          style={
            note.post.width && note.post.height
              ? { aspectRatio: `${note.post.width} / ${note.post.height}` }
              : { aspectRatio: "1" }
          }
        />
        {(isVideo || isAnimated) && (
          <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
            {isVideo ? "VIDEO" : "GIF"}
          </span>
        )}
      </div>

      {/* Note content */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-zinc-200 truncate">
            {note.name}
          </h3>
          <span className="shrink-0 text-xs text-zinc-500">
            {note.post.hash.slice(0, 8)}
          </span>
        </div>

        <div
          className="text-sm text-zinc-400 line-clamp-4 [&_mark]:bg-amber-500/30 [&_mark]:text-amber-200 [&_mark]:px-0.5 [&_mark]:rounded"
          dangerouslySetInnerHTML={{ __html: displayContent }}
        />

        {note.post.width && note.post.height && (
          <span className="text-xs text-zinc-500 mt-auto">
            {note.post.width}×{note.post.height}
          </span>
        )}
      </div>
    </Link>
  );
}
