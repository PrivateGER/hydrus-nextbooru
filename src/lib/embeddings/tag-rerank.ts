/**
 * Tag-embedding rerank for semantic text search.
 *
 * Single-vector image retrieval ranks the head of the result window almost
 * flat (see calibration.ts: top-20 neighbors span raw cosine 0.81–0.99), and
 * it is structurally weak at compositional queries. This module reorders the
 * retrieved window using a second signal that is already in the database:
 * how well each candidate's TAGS semantically match the query text.
 *
 * The match is embedding-to-embedding, never lexical — "lying on her back"
 * scores against the tag `on_back` through their text vectors, so phrasing
 * differences don't matter. Per candidate, the top
 * {@link TAG_RERANK_TOP_TAGS} tag similarities are calibrated against the
 * tag channel's random-pair baseline and combined as a declining-weight mean
 * with a FIXED denominator: a missing tag contributes exactly what an
 * unrelated tag would (~0 after calibration), so thinly-tagged posts are not
 * spuriously boosted, while a single strong tag match still moves a post
 * meaningfully.
 *
 * The final order blends both channels on the calibrated [0, 1] scale
 * (70% image, 30% tags — the same split the feed's tag-IDF blend settled
 * on). Reranking only PERMUTES the retrieved window: scores, minScore
 * filtering, totalCount, and pagination semantics are untouched, and the
 * whole window is reordered before slicing so every page sees the same
 * order. Fail-open: any error in the tag channel logs and returns the
 * original distance order.
 */

import { searchLog } from "@/lib/logger";
import { calibrateEmbeddingScore, getEmbeddingBaseline, getTagEmbeddingBaseline } from "@/lib/embeddings/calibration";
import type { EmbeddingConfig } from "@/lib/embeddings/settings";
import type { SemanticPostResult } from "@/lib/embeddings/store";
import {
  hasTagEmbeddingsForConfig,
  scoreCandidateTagSims,
  toTagEmbeddingConfig,
} from "@/lib/embeddings/tag-store";

/** Best-matching tags considered per candidate post. */
export const TAG_RERANK_TOP_TAGS = 3;

/**
 * Declining weights over a candidate's best tag matches. The strongest match
 * dominates ("on_back" alone should carry a pose query), extra matches help
 * without letting many weak ones outvote one strong one.
 */
const TAG_RERANK_TAG_WEIGHTS = [1, 0.5, 0.25] as const;

/** Share of the blended score carried by the tag channel. */
export const TAG_RERANK_BLEND_WEIGHT = 0.3;

/**
 * Combine a candidate's raw tag similarities into a [0, 1] tag score.
 *
 * Each similarity is calibrated first, THEN weighted — calibration clamps
 * sub-baseline matches to 0, so averaging calibrated values keeps unrelated
 * tags from dragging a strong match down (averaging raw values would).
 * The denominator is the full weight mass regardless of how many tags the
 * post has: absent tags count as unrelated, not as missing data.
 */
export function aggregateTagScore(sims: number[], tagBaseline: number): number {
  const top = [...sims]
    .sort((a, b) => b - a)
    .slice(0, TAG_RERANK_TOP_TAGS);

  let weighted = 0;
  let weightMass = 0;
  for (const [index, weight] of TAG_RERANK_TAG_WEIGHTS.entries()) {
    weighted += weight * calibrateEmbeddingScore(top[index] ?? 0, tagBaseline);
    weightMass += weight;
  }

  return weighted / weightMass;
}

/** Blend the calibrated image cosine with the aggregated tag score. */
export function blendSemanticScore(
  imageScore: number,
  tagScore: number,
  imageBaseline: number
): number {
  return (
    (1 - TAG_RERANK_BLEND_WEIGHT) * calibrateEmbeddingScore(imageScore, imageBaseline) +
    TAG_RERANK_BLEND_WEIGHT * tagScore
  );
}

/**
 * Reorder semantic results by the blended score. Pure and deterministic:
 * ties keep the incoming (image-distance) order, so with no tag signal at
 * all the permutation is the identity.
 */
export function orderByBlendedScore<T extends { id: number; score: number }>(
  posts: T[],
  tagScoresByPostId: Map<number, number>,
  imageBaseline: number
): T[] {
  return posts
    .map((post, index) => ({
      post,
      index,
      blended: blendSemanticScore(post.score, tagScoresByPostId.get(post.id) ?? 0, imageBaseline),
    }))
    .sort((a, b) => (b.blended - a.blended) || (a.index - b.index))
    .map((entry) => entry.post);
}

/**
 * Rerank a retrieved semantic-search window by tag-embedding match.
 *
 * No-op (and cheap: one EXISTS query) when the tag vocabulary has never been
 * embedded for the active config, so instances that skip the tag batch keep
 * exactly today's behavior. Fail-open on any error.
 */
export async function rerankSemanticPostsByTags(
  posts: SemanticPostResult[],
  options: {
    config: EmbeddingConfig;
    queryEmbedding: number[];
  }
): Promise<SemanticPostResult[]> {
  if (posts.length <= 1) return posts;

  try {
    const tagConfig = toTagEmbeddingConfig(options.config);
    if (!(await hasTagEmbeddingsForConfig(tagConfig))) {
      return posts;
    }

    const [sims, imageBaseline, tagBaseline] = await Promise.all([
      scoreCandidateTagSims({
        config: tagConfig,
        embedding: options.queryEmbedding,
        postIds: posts.map((post) => post.id),
        topK: TAG_RERANK_TOP_TAGS,
      }),
      getEmbeddingBaseline(options.config),
      getTagEmbeddingBaseline(tagConfig),
    ]);

    const simsByPostId = new Map<number, number[]>();
    for (const { postId, sim } of sims) {
      const entry = simsByPostId.get(postId);
      if (entry) entry.push(sim);
      else simsByPostId.set(postId, [sim]);
    }

    const tagScoresByPostId = new Map<number, number>();
    for (const [postId, postSims] of simsByPostId) {
      tagScoresByPostId.set(postId, aggregateTagScore(postSims, tagBaseline));
    }

    return orderByBlendedScore(posts, tagScoresByPostId, imageBaseline);
  } catch (error) {
    searchLog.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Tag rerank failed; returning distance order"
    );
    return posts;
  }
}
