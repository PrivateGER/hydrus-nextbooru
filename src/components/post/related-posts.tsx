import { getRecommendationsByHash } from "@/lib/recommendations";
import { RelatedPostsClient } from "./related-posts-client";

interface RelatedPostsProps {
  hash: string;
  limit?: number;
}

/**
 * Server component that fetches and displays recommended posts.
 * Uses RelatedPostsClient for the enhanced UI rendering.
 */
export async function RelatedPosts({ hash, limit = 10 }: RelatedPostsProps) {
  const recommendations = await getRecommendationsByHash(hash, limit);

  if (recommendations.length === 0) {
    return null;
  }

  return <RelatedPostsClient recommendations={recommendations} />;
}
