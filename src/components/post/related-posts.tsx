import Link from "next/link";
import { getRecommendationsByHash, type RecommendedPost } from "@/lib/recommendations";

interface RelatedPostsProps {
  hash: string;
  limit?: number;
}

/**
 * Server component that displays recommended posts based on tag similarity.
 * Uses a horizontal scrollable filmstrip layout similar to group display.
 */
export async function RelatedPosts({ hash, limit = 10 }: RelatedPostsProps) {
  const recommendations = await getRecommendationsByHash(hash, limit);

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg bg-zinc-800 p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold">Similar Posts</h2>
        <span className="text-sm text-zinc-500">
          {recommendations.length} {recommendations.length === 1 ? "image" : "images"}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
        {recommendations.map((rec) => (
          <Link
            key={rec.hash}
            href={`/post/${rec.hash}`}
            className="shrink-0 overflow-hidden rounded-lg bg-zinc-700 snap-start transition-transform hover:scale-[1.02] hover:ring-2 hover:ring-blue-500"
          >
            <img
              src={`/api/thumbnails/${rec.hash}.webp`}
              alt=""
              className="h-24 w-auto"
              style={
                rec.width && rec.height
                  ? { aspectRatio: `${rec.width} / ${rec.height}` }
                  : { aspectRatio: "1" }
              }
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
