/**
 * Embedding-similarity calibration.
 *
 * Modern embedding models (e.g. gemini-embedding) are anisotropic: all vectors
 * crowd into a narrow cone, so even unrelated images score a high raw cosine.
 * Measured on prod (gemini-embedding-2 @3072d): random pairs sit at p50 0.66
 * (min 0.47), while top-20 neighbors span only 0.81–0.99. Blending that raw
 * cosine against the tag-IDF cosine (which IS ~0 for unrelated posts) makes
 * the embedding channel ~89% of a typical pair's score instead of the nominal
 * 70%, and its within-channel ranking nearly flat.
 *
 * The fix: estimate the model's random-pair similarity BASELINE and rescale
 *   calibrated = max(0, (raw - baseline) / (1 - baseline))
 * so "unrelated" maps to ~0 and near-duplicates stay ~1, restoring a
 * comparable scale to both channels.
 *
 * The baseline is a model property, so it is estimated from the store itself
 * (a random sample of stored embeddings, pairwise similarity, high
 * percentile) and cached in the Settings table keyed by the full embedding
 * config. Switching models/dimensions invalidates the cache by key mismatch.
 * When the store is too small to estimate (or estimation fails), the baseline
 * is 0 and calibration degrades to the identity rescale.
 */

import { prisma } from "@/lib/db";
import { vectorType } from "@/lib/embeddings/store";
import type { EmbeddingConfig } from "@/lib/embeddings/settings";
import { updateSettings } from "@/lib/openrouter/settings";
import { SETTINGS_KEYS } from "@/lib/openrouter/types";
import { aiLog } from "@/lib/logger";

/** Embeddings sampled for pairwise estimation (48 -> 1128 pairs). */
const CALIBRATION_SAMPLE_SIZE = 48;

/**
 * Minimum sampled embeddings for a usable estimate. Below this the baseline
 * is 0 (identity rescale). Between this and {@link CALIBRATION_SAMPLE_SIZE}
 * the estimate is used for the current build but NOT persisted — it is
 * re-estimated per build until the store can supply the full sample, so a
 * small-sample artifact can never stick in the cache.
 */
const MIN_CALIBRATION_SAMPLE = 16;

/**
 * Percentile of the random-pair similarity distribution used as the baseline:
 * ~this share of random pairs calibrates to exactly 0. p90 rather than max so
 * a single accidental near-duplicate pair in the sample cannot inflate the
 * baseline.
 */
const CALIBRATION_PERCENTILE = 0.9;

/**
 * Baseline ceiling. A degenerate store (all near-identical images) could
 * estimate a baseline near 1, making the rescale divide by ~0 and explode
 * tiny raw differences; 0.95 keeps the transform well-conditioned.
 */
const MAX_BASELINE = 0.95;

export interface EmbeddingCalibration {
  /** Random-pair similarity percentile in [0, MAX_BASELINE]; 0 = identity. */
  baseline: number;
  /** Embeddings sampled for the estimate. */
  sampleSize: number;
  /** ISO timestamp of estimation. */
  computedAt: string;
  /** Config identity — a mismatch on any field invalidates the cache. */
  baseUrl: string;
  model: string;
  dimensions: number;
  imageMaxResolution: number;
}

/**
 * Rescale a raw embedding cosine against the model's random-pair baseline.
 * Identity at baseline 0; monotone, clamped to [0, 1].
 */
export function calibrateEmbeddingScore(raw: number, baseline: number): number {
  if (baseline <= 0) return Math.max(0, Math.min(1, raw));
  const b = Math.min(baseline, MAX_BASELINE);
  return Math.max(0, Math.min(1, (raw - b) / (1 - b)));
}

/**
 * Convert a calibrated-space minimum score to the raw cosine the ANN query's
 * distance prefilter understands (inverse of {@link calibrateEmbeddingScore}).
 */
export function rawMinScoreFor(calibratedMin: number, baseline: number): number {
  if (baseline <= 0) return calibratedMin;
  const b = Math.min(baseline, MAX_BASELINE);
  return b + calibratedMin * (1 - b);
}

function isCalibrationForConfig(
  value: unknown,
  config: EmbeddingConfig
): value is EmbeddingCalibration {
  if (typeof value !== "object" || value === null) return false;
  const cal = value as Partial<EmbeddingCalibration>;
  return (
    typeof cal.baseline === "number" &&
    Number.isFinite(cal.baseline) &&
    cal.baseline >= 0 &&
    cal.baseline <= MAX_BASELINE &&
    typeof cal.sampleSize === "number" &&
    // Only FULL-sample calibrations are cache-valid: a partial estimate taken
    // while the store was still filling must not stick forever (it is used
    // transiently and re-estimated each build until the store reaches
    // CALIBRATION_SAMPLE_SIZE).
    cal.sampleSize >= CALIBRATION_SAMPLE_SIZE &&
    cal.baseUrl === config.baseUrl &&
    cal.model === config.model &&
    cal.dimensions === config.dimensions &&
    cal.imageMaxResolution === config.imageMaxResolution
  );
}

/**
 * Estimate the random-pair similarity baseline from the stored embeddings.
 *
 * Samples {@link CALIBRATION_SAMPLE_SIZE} embeddings for the config
 * (deterministically, by hashed id — no ORDER BY random() table churn),
 * computes all pairwise cosines, and returns the
 * {@link CALIBRATION_PERCENTILE} percentile. Returns null when fewer than
 * {@link MIN_CALIBRATION_SAMPLE} embeddings exist.
 */
export async function estimateEmbeddingBaseline(
  config: EmbeddingConfig
): Promise<{ baseline: number; sampleSize: number } | null> {
  const vectorTypeSql = vectorType(config.dimensions);

  const rows = await prisma.$queryRaw<
    { baseline: number | null; sample_size: bigint | number }[]
  >`
    WITH sample AS (
      SELECT s.embedding::${vectorTypeSql} AS emb,
             row_number() OVER () AS rn
      FROM (
        SELECT pe.embedding
        FROM "PostEmbedding" pe
        WHERE pe."baseUrl" = ${config.baseUrl}
          AND pe.model = ${config.model}
          AND pe.dimensions = ${config.dimensions}
          AND pe."imageMaxResolution" = ${config.imageMaxResolution}
          AND pe.status = 'COMPLETE'::"EmbeddingStatus"
          AND pe.embedding IS NOT NULL
        ORDER BY md5(pe.id::text)
        LIMIT ${CALIBRATION_SAMPLE_SIZE}
      ) s
    )
    SELECT
      percentile_cont(${CALIBRATION_PERCENTILE}) WITHIN GROUP (
        ORDER BY 1 - (a.emb <=> b.emb)
      )::float8 AS baseline,
      (SELECT count(*) FROM sample)::int AS sample_size
    FROM sample a
    JOIN sample b ON a.rn < b.rn
  `;

  const row = rows[0];
  const sampleSize = Number(row?.sample_size ?? 0);
  if (!row || row.baseline === null || sampleSize < MIN_CALIBRATION_SAMPLE) {
    return null;
  }

  return {
    baseline: Math.max(0, Math.min(MAX_BASELINE, row.baseline)),
    sampleSize,
  };
}

/**
 * The calibration baseline for a config: cached in Settings, estimated (and
 * persisted) on miss, 0 whenever the store is too small or estimation fails —
 * so callers can apply {@link calibrateEmbeddingScore} unconditionally.
 */
export async function getEmbeddingBaseline(config: EmbeddingConfig): Promise<number> {
  try {
    const row = await prisma.settings.findUnique({
      where: { key: SETTINGS_KEYS.EMBEDDING_CALIBRATION },
      select: { value: true },
    });
    if (row) {
      try {
        const parsed: unknown = JSON.parse(row.value);
        if (isCalibrationForConfig(parsed, config)) return parsed.baseline;
      } catch {
        // Corrupt JSON: fall through to re-estimation, which overwrites it.
      }
    }

    const estimate = await estimateEmbeddingBaseline(config);
    if (!estimate) return 0;

    const calibration: EmbeddingCalibration = {
      ...estimate,
      computedAt: new Date().toISOString(),
      baseUrl: config.baseUrl,
      model: config.model,
      dimensions: config.dimensions,
      imageMaxResolution: config.imageMaxResolution,
    };
    // Persist ONLY full-sample calibrations. A partial estimate (store still
    // filling: 16..47 embeddings) is used for THIS build but re-estimated on
    // the next one, so the cached value can never be a permanently skewed
    // small-sample artifact. Best-effort: a failed Settings write must not
    // discard a good estimate — the next build simply re-estimates
    // (deterministic sample, same result).
    if (estimate.sampleSize >= CALIBRATION_SAMPLE_SIZE) {
      try {
        await updateSettings({
          [SETTINGS_KEYS.EMBEDDING_CALIBRATION]: JSON.stringify(calibration),
        });
      } catch (error) {
        aiLog.error(
          { error: error instanceof Error ? error.message : String(error) },
          "Failed to persist embedding calibration; continuing with estimate"
        );
      }
    }
    aiLog.info(
      { baseline: calibration.baseline, sampleSize: calibration.sampleSize, model: config.model },
      "Estimated embedding calibration baseline"
    );
    return calibration.baseline;
  } catch (error) {
    aiLog.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Embedding calibration unavailable; using identity rescale"
    );
    return 0;
  }
}
