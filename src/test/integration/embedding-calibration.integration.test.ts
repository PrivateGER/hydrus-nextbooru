import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from "./setup";
import { setTestPrisma } from "@/lib/db";
import { createPost } from "./factories";
import { upsertCompleteEmbedding } from "@/lib/embeddings/store";
import {
  estimateEmbeddingBaseline,
  getEmbeddingBaseline,
  invalidateEmbeddingCalibration,
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

  it("uses a partial-sample estimate transiently without persisting it", async () => {
    // 12 mutually orthogonal vectors (162 random-like pairs at sim 0) plus 8
    // identical vectors (28 pairs at sim 1): 28/190 ≈ 15% of pairwise sims are
    // 1, so the p90 lands at 1 and MUST be clamped to the 0.95 ceiling —
    // exercising estimation, percentile, and conditioning guard in one shape.
    // 20 embeddings is above MIN_CALIBRATION_SAMPLE but below the full
    // 48-sample size, so the estimate is used for the build but MUST NOT be
    // cached (a store-still-filling artifact would otherwise stick forever).
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

    expect(await getEmbeddingBaseline(config)).toBe(0.95);

    // NOT cached: no Settings row, and wiping the embeddings degrades to 0
    // instead of serving a stale partial-sample baseline.
    const row = await getTestPrisma().settings.findUnique({
      where: { key: SETTINGS_KEYS.EMBEDDING_CALIBRATION },
    });
    expect(row).toBeNull();
    await getTestPrisma().postEmbedding.deleteMany();
    expect(await getEmbeddingBaseline(config)).toBe(0);
  });

  it("persists a full-sample baseline and invalidates it on config change", async () => {
    // 48 embeddings = the full calibration sample: 36 identical (630 pairs at
    // sim 1) + 12 orthogonal (498 pairs at sim 0) → p90 = 1, clamped to 0.95.
    for (let i = 0; i < 12; i++) {
      await insertEmbedding(basisVector(i));
    }
    for (let i = 0; i < 36; i++) {
      await insertEmbedding(basisVector(100));
    }

    expect(await getEmbeddingBaseline(config)).toBe(0.95);

    // Cached: wiping the embeddings must not change the answer.
    await getTestPrisma().postEmbedding.deleteMany();
    expect(await getEmbeddingBaseline(config)).toBe(0.95);

    // A different model has no embeddings stored: the stale cache must not be
    // served for it, and with nothing to sample the baseline degrades to 0.
    const otherModel = { ...config, model: "some/other-model" };
    expect(await getEmbeddingBaseline(otherModel)).toBe(0);
  });

  it("rejects a cached baseline stamped under an older invalidation generation", async () => {
    // Simulates the write-after-invalidate race: a row persisted by an
    // estimator that started BEFORE an invalidation carries the old
    // generation stamp and must be treated as a miss by every reader, no
    // matter when its write landed.
    const prisma = getTestPrisma();
    await prisma.settings.create({
      data: {
        key: SETTINGS_KEYS.EMBEDDING_CALIBRATION,
        value: JSON.stringify({
          baseline: 0.9,
          sampleSize: 48,
          computedAt: new Date().toISOString(),
          generation: 0, // stale stamp
          ...config,
        }),
      },
    });
    await prisma.settings.create({
      data: { key: SETTINGS_KEYS.EMBEDDING_CALIBRATION_GENERATION, value: "1" },
    });

    // Empty store: a rejected cache row cannot be re-estimated, so the
    // stale 0.9 must NOT be served — identity baseline instead.
    expect(await getEmbeddingBaseline(config)).toBe(0);
  });

  it("re-estimates and re-persists under the new generation after invalidation", async () => {
    const prisma = getTestPrisma();
    for (let i = 0; i < 12; i++) {
      await insertEmbedding(basisVector(i));
    }
    for (let i = 0; i < 36; i++) {
      await insertEmbedding(basisVector(100));
    }

    expect(await getEmbeddingBaseline(config)).toBe(0.95);

    await invalidateEmbeddingCalibration();
    expect(
      await prisma.settings.findUnique({ where: { key: SETTINGS_KEYS.EMBEDDING_CALIBRATION } })
    ).toBeNull();
    expect(
      (await prisma.settings.findUnique({
        where: { key: SETTINGS_KEYS.EMBEDDING_CALIBRATION_GENERATION },
      }))?.value
    ).toBe("1");

    // Store unchanged: re-estimation lands the same value, now stamped with
    // generation 1 — proven by the cache surviving a store wipe.
    expect(await getEmbeddingBaseline(config)).toBe(0.95);
    await prisma.postEmbedding.deleteMany();
    expect(await getEmbeddingBaseline(config)).toBe(0.95);

    // A second invalidation moves the fence again and drops the row.
    await invalidateEmbeddingCalibration();
    expect(await getEmbeddingBaseline(config)).toBe(0);
  });
});
