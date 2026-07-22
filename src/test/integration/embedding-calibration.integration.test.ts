import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from "./setup";
import { setTestPrisma } from "@/lib/db";
import { createPost } from "./factories";
import { upsertCompleteEmbedding } from "@/lib/embeddings/store";
import {
  estimateEmbeddingBaseline,
  getEmbeddingBaseline,
} from "@/lib/embeddings/calibration";
import { SETTINGS_KEYS } from "@/lib/openrouter/types";

const dimensions = 768;
const config = {
  baseUrl: "https://openrouter.ai/api/v1",
  model: "google/gemini-embedding-2-preview",
  dimensions,
  imageMaxResolution: 1024,
};

/** Unit basis vector e_axis in 768 dims. */
function basisVector(axis: number): number[] {
  const vector = Array.from({ length: dimensions }, () => 0);
  vector[axis] = 1;
  return vector;
}

async function insertEmbedding(vector: number[]) {
  const prisma = getTestPrisma();
  const post = await createPost(prisma, { mimeType: "image/png", extension: ".png" });
  await upsertCompleteEmbedding({
    postId: post.id,
    config,
    embedding: vector,
    sourceWidth: 100,
    sourceHeight: 100,
    processedWidth: 100,
    processedHeight: 100,
  });
}

describe("embedding calibration (integration)", () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);
  });

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  it("refuses to estimate from too small a store", async () => {
    // 15 embeddings — one below MIN_CALIBRATION_SAMPLE.
    for (let i = 0; i < 15; i++) {
      await insertEmbedding(basisVector(i));
    }

    expect(await estimateEmbeddingBaseline(config)).toBeNull();

    // getEmbeddingBaseline degrades to the identity baseline and does NOT
    // persist a junk calibration.
    expect(await getEmbeddingBaseline(config)).toBe(0);
    const row = await getTestPrisma().settings.findUnique({
      where: { key: SETTINGS_KEYS.EMBEDDING_CALIBRATION },
    });
    expect(row).toBeNull();
  });

  it("estimates a clamped high-percentile baseline and caches it in Settings", async () => {
    // 12 mutually orthogonal vectors (162 random-like pairs at sim 0) plus 8
    // identical vectors (28 pairs at sim 1): 28/190 ≈ 15% of pairwise sims are
    // 1, so the p90 lands at 1 and MUST be clamped to the 0.95 ceiling —
    // exercising estimation, percentile, and conditioning guard in one shape.
    for (let i = 0; i < 12; i++) {
      await insertEmbedding(basisVector(i));
    }
    for (let i = 0; i < 8; i++) {
      await insertEmbedding(basisVector(100));
    }

    const estimate = await estimateEmbeddingBaseline(config);
    expect(estimate).not.toBeNull();
    expect(estimate!.sampleSize).toBe(20);
    expect(estimate!.baseline).toBe(0.95);

    const baseline = await getEmbeddingBaseline(config);
    expect(baseline).toBe(0.95);

    // Cached: wiping the embeddings must not change the answer.
    await getTestPrisma().postEmbedding.deleteMany();
    expect(await getEmbeddingBaseline(config)).toBe(0.95);
  });

  it("invalidates the cached baseline when the embedding config changes", async () => {
    for (let i = 0; i < 12; i++) {
      await insertEmbedding(basisVector(i));
    }
    for (let i = 0; i < 8; i++) {
      await insertEmbedding(basisVector(100));
    }
    expect(await getEmbeddingBaseline(config)).toBe(0.95);

    // A different model has no embeddings stored: the stale cache must not be
    // served for it, and with nothing to sample the baseline degrades to 0.
    const otherModel = { ...config, model: "some/other-model" };
    expect(await getEmbeddingBaseline(otherModel)).toBe(0);
  });
});
