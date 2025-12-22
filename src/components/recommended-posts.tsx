import Link from "next/link";

interface RecommendedPost {
  id: number;
  hash: string;
  width: number | null;
  height: number | null;
  mimeType: string;
  sharedTagCount: number;
}

interface RecommendedPostsProps {
  posts: RecommendedPost[];
}

/**
 * Display a horizontal scrollable grid of recommended posts based on tag similarity.
 *
 * Shows up to 12 recommended posts with thumbnails in a filmstrip-style layout.
 * Each thumbnail displays a badge indicating how many tags it shares with the current post.
 *
 * @param posts - Array of recommended posts with similarity scores
 */
export function RecommendedPosts({ posts }: RecommendedPostsProps) {
  if (posts.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg bg-zinc-800 p-4">
      <h2 className="mb-3 text-lg font-semibold">Recommended Posts</h2>
      <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
        {posts.map((post) => {
          const isVideo = post.mimeType.startsWith("video/");
          const isAnimated =
            post.mimeType === "image/gif" || post.mimeType === "image/apng";

          return (
            <Link
              key={post.hash}
              href={`/post/${post.hash}`}
              className="relative shrink-0 overflow-hidden rounded-lg bg-zinc-700 snap-start transition-transform hover:scale-[1.02] hover:ring-2 hover:ring-blue-500"
            >
              <img
                src={`/api/thumbnails/${post.hash}.webp`}
                alt=""
                className="h-32 w-auto"
                style={
                  post.width && post.height
                    ? { aspectRatio: `${post.width} / ${post.height}` }
                    : { aspectRatio: "1" }
                }
                loading="lazy"
              />
              {/* Shared tag count badge */}
              <span className="absolute top-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
                {post.sharedTagCount} tag{post.sharedTagCount !== 1 ? "s" : ""}
              </span>
              {/* Video/GIF indicator */}
              {(isVideo || isAnimated) && (
                <div className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
                  {isVideo ? "VIDEO" : "GIF"}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
