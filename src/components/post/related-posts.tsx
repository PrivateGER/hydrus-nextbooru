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
            className="relative shrink-0 overflow-hidden rounded-lg bg-zinc-700 snap-start transition-transform hover:scale-[1.02] hover:ring-2 hover:ring-blue-500"
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
            <SimilarityBadge score={rec.score} />
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * Small badge showing similarity score as a percentage indicator.
 */
function SimilarityBadge({ score }: { score: number }) {
  // Convert IDF score to a rough percentage for display
  // Higher scores = more similar
  // We'll just show a simple indicator based on relative score
  const percentage = Math.min(99, Math.round(score * 5)); // Rough scaling

  return (
    <span
      className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white"
      title={`Similarity score: ${score.toFixed(2)}`}
    >
      {percentage}%
    </span>
  );
}
