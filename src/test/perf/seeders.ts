/**
 * Large dataset seeders for performance tests.
 *
 * All randomness is deterministic (seeded PRNG) so datasets — and
 * therefore benchmark numbers — are reproducible across runs. Tag
 * assignment follows a Zipf distribution: real booru tagging is
 * power-law (a few tags on a large share of posts, a long tail of rare
 * tags), and uniform sampling hides exactly the co-occurrence and
 * AND-search behavior these benchmarks must exercise.
 */

import { PrismaClient, TagCategory } from '@/generated/prisma/client';
import { createHash } from 'crypto';
import { createPostsBulk, createTagsBulk, linkPostsToTagsBulk } from '../integration/factories';
import { createRng, createZipfSampler } from './rng';
import { unitVector, randomPhash, noteContent } from './synthetic';

/** Fixed seed: change it and every dataset (and benchmark) shifts. */
const SEED = 0xb04a11;

/** Process-wide rng for query-time helpers (stable across runs, varied within). */
const helperRng = createRng(SEED ^ 0x5eed);

/** Matches PostgreSQL's encode(digest(content, 'sha256'), 'hex'). */
function sha256Hex(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function fisherYates<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickRandom<T>(arr: T[], count: number, rng: () => number = helperRng): T[] {
  return fisherYates(arr, rng).slice(0, count);
}

/**
 * Configuration for dataset seeding
 */
export interface SeedConfig {
  /** Number of posts to create */
  posts: number;
  /** Number of unique tags across all categories */
  uniqueTags: number;
  /** Average tags per post */
  tagsPerPost: number;
  /** Distribution of tags per category (should sum to 1) */
  categoryDistribution?: Record<TagCategory, number>;
  /** Zipf exponent for tag popularity (1.0 ≈ classic power law) */
  zipfExponent?: number;
}

const DEFAULT_CATEGORY_DISTRIBUTION: Record<TagCategory, number> = {
  [TagCategory.GENERAL]: 0.6,
  [TagCategory.ARTIST]: 0.1,
  [TagCategory.CHARACTER]: 0.15,
  [TagCategory.COPYRIGHT]: 0.1,
  [TagCategory.META]: 0.05,
};

/**
 * Seed a large dataset for performance testing.
 * Creates tags and posts with a deterministic, Zipf-distributed
 * tag-popularity profile.
 */
export async function seedLargeDataset(
  prisma: PrismaClient,
  config: Partial<SeedConfig> = {}
): Promise<{ tagCount: number; postCount: number }> {
  const {
    posts = 50_000,
    uniqueTags = 10_000,
    tagsPerPost = 20,
    categoryDistribution = DEFAULT_CATEGORY_DISTRIBUTION,
    zipfExponent = 1.0,
  } = config;

  const rng = createRng(SEED);

  console.log(`Seeding dataset: ${posts} posts, ${uniqueTags} tags, ~${tagsPerPost} tags/post (zipf s=${zipfExponent})`);
  const startTime = performance.now();

  // Step 1: Create tags by category using bulk factory
  const allTags: { id: number; category: TagCategory }[] = [];

  for (const category of Object.values(TagCategory)) {
    const count = Math.floor(uniqueTags * categoryDistribution[category]);
    const names = Array.from({ length: count }, (_, i) => `${category.toLowerCase()}_tag_${i}`);

    const tagIds = await createTagsBulk(prisma, names, category);
    tagIds.forEach(id => allTags.push({ id, category }));
  }

  console.log(`  Created ${allTags.length} tags in ${((performance.now() - startTime) / 1000).toFixed(1)}s`);

  // Popularity rank is decoupled from creation order/category by a
  // deterministic shuffle; rank 0 is the most popular tag.
  const ranked = fisherYates(allTags, rng);
  const sampleTagRank = createZipfSampler(ranked.length, zipfExponent, rng);

  // Step 2: Create posts in batches with tags using bulk factories
  const BATCH_SIZE = 5000;
  let createdPosts = 0;

  for (let batch = 0; batch < posts; batch += BATCH_SIZE) {
    const batchSize = Math.min(BATCH_SIZE, posts - batch);

    // Deterministic hashes: random-order and phash benchmarks depend on
    // the Post.hash distribution, so it must reproduce across runs.
    const postIds = await createPostsBulk(prisma, batchSize, {
      hashSeed: `perf-${SEED}-${batch}`,
    });

    // Build post-tag relations: Zipf-sampled with per-post dedupe.
    const postTagData: { postId: number; tagId: number }[] = [];
    for (const postId of postIds) {
      const target = Math.max(1, tagsPerPost + Math.floor(rng() * 11) - 5); // ±5 variance
      const chosen = new Set<number>();
      // Popular ranks repeat often; cap attempts so the loop always ends.
      let attempts = 0;
      while (chosen.size < target && attempts < target * 5) {
        chosen.add(ranked[sampleTagRank()].id);
        attempts++;
      }

      for (const tagId of chosen) {
        postTagData.push({ postId, tagId });
      }
    }

    // Use bulk factory for post-tag links
    await linkPostsToTagsBulk(prisma, postTagData);

    createdPosts += batchSize;

    if (createdPosts % 5000 === 0) {
      console.log(`  Created ${createdPosts}/${posts} posts...`);
    }
  }

  // Step 3: Update tag counts
  console.log('  Updating tag counts...');
  await prisma.$executeRaw`
    UPDATE "Tag" SET "postCount" = (
      SELECT COUNT(*) FROM "PostTag" WHERE "PostTag"."tagId" = "Tag"."id"
    )
  `;

  const elapsed = (performance.now() - startTime) / 1000;
  console.log(`  Dataset seeded in ${elapsed.toFixed(1)}s`);

  return { tagCount: allTags.length, postCount: createdPosts };
}

/**
 * Seed a smaller dataset for quick iteration during development
 */
export async function seedSmallDataset(prisma: PrismaClient): Promise<{ tagCount: number; postCount: number }> {
  return seedLargeDataset(prisma, {
    posts: 1_000,
    uniqueTags: 500,
    tagsPerPost: 10,
  });
}

/**
 * Seed a medium dataset for balanced testing
 */
export async function seedMediumDataset(prisma: PrismaClient): Promise<{ tagCount: number; postCount: number }> {
  return seedLargeDataset(prisma, {
    posts: 5_000,
    uniqueTags: 2_000,
    tagsPerPost: 12,
  });
}

/**
 * Seed an extra-large dataset for local soak testing. Not intended for CI.
 */
export async function seedXLargeDataset(prisma: PrismaClient): Promise<{ tagCount: number; postCount: number }> {
  return seedLargeDataset(prisma, {
    posts: 250_000,
    uniqueTags: 50_000,
    tagsPerPost: 20,
  });
}

/**
 * Seed dataset based on PERF_DATASET_SIZE environment variable.
 * Defaults to 'medium' if not set.
 */
export async function seedDataset(prisma: PrismaClient): Promise<{ tagCount: number; postCount: number }> {
  const size = process.env.PERF_DATASET_SIZE || 'medium';

  switch (size) {
    case 'xlarge':
      return seedXLargeDataset(prisma);
    case 'large':
      return seedLargeDataset(prisma);
    case 'small':
      return seedSmallDataset(prisma);
    case 'medium':
    default:
      return seedMediumDataset(prisma);
  }
}

/** Embedding config used by perf seeding and vector-search benchmarks. */
export const PERF_EMBEDDING_CONFIG = {
  baseUrl: 'http://perf-embeddings.local',
  model: 'perf-clip',
  dimensions: 768,
  imageMaxResolution: 512,
} as const;

/**
 * Seed one COMPLETE embedding per post (deterministic unit vectors) for
 * the perf embedding config. 768 dimensions matches one of the
 * vchordrq-indexed dimension variants.
 */
export async function seedEmbeddings(
  prisma: PrismaClient,
  options: { config?: typeof PERF_EMBEDDING_CONFIG } = {}
): Promise<{ embeddingCount: number }> {
  const config = options.config ?? PERF_EMBEDDING_CONFIG;
  const rng = createRng(SEED ^ 0xe33d);

  const posts = await prisma.post.findMany({ select: { id: true }, orderBy: { id: 'asc' } });

  console.log(`Seeding ${posts.length} embeddings (${config.dimensions}d)...`);
  const startTime = performance.now();

  // ~200 vectors x 768 dims keeps each statement's parameter size sane.
  const BATCH_SIZE = 200;
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);
    const ids = batch.map((p) => p.id);
    const vectors = batch.map(() =>
      `[${unitVector(config.dimensions, rng).map((x) => x.toFixed(6)).join(',')}]`
    );

    await prisma.$executeRaw`
      INSERT INTO "PostEmbedding"
        ("postId", "baseUrl", model, dimensions, "imageMaxResolution", embedding, status, "computedAt", "updatedAt")
      SELECT pid, ${config.baseUrl}, ${config.model}, ${config.dimensions}, ${config.imageMaxResolution},
             vec::vector, 'COMPLETE'::"EmbeddingStatus", NOW(), NOW()
      FROM unnest(${ids}::int[], ${vectors}::text[]) AS t(pid, vec)
    `;
  }

  console.log(`  Embeddings seeded in ${((performance.now() - startTime) / 1000).toFixed(1)}s`);
  return { embeddingCount: posts.length };
}

/** Seed one PhashEntry per post with deterministic 64-bit hashes. */
export async function seedPhashes(prisma: PrismaClient): Promise<{ phashCount: number }> {
  const rng = createRng(SEED ^ 0x9a54);

  const posts = await prisma.post.findMany({ select: { hash: true }, orderBy: { id: 'asc' } });

  console.log(`Seeding ${posts.length} phash entries...`);
  const startTime = performance.now();

  const BATCH_SIZE = 5000;
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);
    const hashes = batch.map((p) => p.hash);
    // BigInt params are passed as strings and cast server-side.
    const phashes = batch.map(() => randomPhash(rng).toString());

    await prisma.$executeRaw`
      INSERT INTO "PhashEntry" (hash, phash)
      SELECT h, p::bigint
      FROM unnest(${hashes}::text[], ${phashes}::text[]) AS t(h, p)
    `;
  }

  console.log(`  Phashes seeded in ${((performance.now() - startTime) / 1000).toFixed(1)}s`);
  return { phashCount: posts.length };
}

/**
 * Seed notes on a deterministic subset of posts (default ~30%) with
 * synthetic multi-word content for full-text search benchmarks.
 */
export async function seedNotes(
  prisma: PrismaClient,
  options: { fraction?: number; wordsPerNote?: number } = {}
): Promise<{ noteCount: number }> {
  const { fraction = 0.3, wordsPerNote = 30 } = options;
  const rng = createRng(SEED ^ 0x07e5);

  const posts = await prisma.post.findMany({ select: { id: true }, orderBy: { id: 'asc' } });
  const step = Math.max(1, Math.round(1 / fraction));
  const selected = posts.filter((_, idx) => idx % step === 0);

  console.log(`Seeding ${selected.length} notes...`);
  const startTime = performance.now();

  const BATCH_SIZE = 2000;
  for (let i = 0; i < selected.length; i += BATCH_SIZE) {
    const batch = selected.slice(i, i + BATCH_SIZE);
    const ids = batch.map((p) => p.id);
    const contents = batch.map(() => noteContent(rng, wordsPerNote));

    await prisma.$executeRaw`
      INSERT INTO "Note" ("postId", name, content)
      SELECT pid, 'perf-note', body
      FROM unnest(${ids}::int[], ${contents}::text[]) AS t(pid, body)
    `;
  }

  console.log(`  Notes seeded in ${((performance.now() - startTime) / 1000).toFixed(1)}s`);
  return { noteCount: selected.length };
}

/**
 * Seed groups (PIXIV/TWITTER/TITLE mix) with PostGroup memberships and
 * translations on a subset of titled groups, for the groups-search
 * benchmarks. Membership inserts run with triggers disabled (the per-row
 * member-stats trigger would make bulk seeding O(n^2)); memberCount and
 * memberHash are refreshed with one aggregate UPDATE at the end, matching
 * the trigger's definition.
 */
export async function seedGroups(
  prisma: PrismaClient,
  options: { groups?: number } = {}
): Promise<{ groupCount: number; membershipCount: number; translationCount: number }> {
  const rng = createRng(SEED ^ 0x9309);

  const posts = await prisma.post.findMany({ select: { id: true }, orderBy: { id: 'asc' } });
  const postIds = fisherYates(posts.map((p) => p.id), rng);
  const groupCount = options.groups ?? Math.max(50, Math.floor(postIds.length / 2));

  console.log(`Seeding ${groupCount} groups...`);
  const startTime = performance.now();

  const sourceTypes: string[] = new Array(groupCount);
  const sourceIds: string[] = new Array(groupCount);
  const titles: (string | null)[] = new Array(groupCount);

  for (let i = 0; i < groupCount; i++) {
    const r = rng();
    if (r < 0.55) {
      sourceTypes[i] = 'PIXIV';
      sourceIds[i] = String(10_000_000 + i);
      titles[i] = null;
    } else if (r < 0.75) {
      sourceTypes[i] = 'TWITTER';
      sourceIds[i] = String(20_000_000 + i);
      titles[i] = null;
    } else {
      // Mirrors sync's TITLE scheme: sourceId = lower(title).
      const title = `${noteContent(rng, 3 + Math.floor(rng() * 3))} ${i}`;
      sourceTypes[i] = 'TITLE';
      sourceIds[i] = title.toLowerCase();
      titles[i] = title;
    }
  }

  const INSERT_BATCH = 5000;
  // Scope everything below to the rows THIS run inserted, so composing or
  // re-running the seeder never mutates unrelated group fixtures.
  const groupRows: Array<{ id: number; title: string | null }> = [];
  for (let i = 0; i < groupCount; i += INSERT_BATCH) {
    const inserted = await prisma.$queryRaw<Array<{ id: number; title: string | null }>>`
      INSERT INTO "Group" ("sourceType", "sourceId", title)
      SELECT u."sourceType"::"SourceType", u."sourceId", u.title
      FROM unnest(
        ${sourceTypes.slice(i, i + INSERT_BATCH)}::text[],
        ${sourceIds.slice(i, i + INSERT_BATCH)}::text[],
        ${titles.slice(i, i + INSERT_BATCH)}::text[]
      ) AS u("sourceType", "sourceId", title)
      RETURNING id, title
    `;
    groupRows.push(...inserted);
  }

  // Memberships: sliding windows over the shuffled post pool, 2-8 members
  // (~5% single-member groups stay ineligible for merged listings).
  const memberGroupIds: number[] = [];
  const memberPostIds: number[] = [];
  const memberPositions: number[] = [];
  let cursor = 0;
  for (const group of groupRows) {
    const size = rng() < 0.05 ? 1 : 2 + Math.floor(rng() * 7);
    for (let m = 0; m < size; m++) {
      memberGroupIds.push(group.id);
      memberPostIds.push(postIds[(cursor + m) % postIds.length]);
      memberPositions.push(m);
    }
    cursor = (cursor + size) % postIds.length;
  }

  // One transaction so SET LOCAL applies to every membership insert: the
  // per-row trigger (and FK checks) are skipped for speed; stats are
  // recomputed below exactly as the trigger would.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL session_replication_role = replica`;
    for (let i = 0; i < memberGroupIds.length; i += INSERT_BATCH) {
      await tx.$executeRaw`
        INSERT INTO "PostGroup" ("groupId", "postId", position)
        SELECT gid, pid, pos
        FROM unnest(
          ${memberGroupIds.slice(i, i + INSERT_BATCH)}::int[],
          ${memberPostIds.slice(i, i + INSERT_BATCH)}::int[],
          ${memberPositions.slice(i, i + INSERT_BATCH)}::int[]
        ) AS t(gid, pid, pos)
        ON CONFLICT DO NOTHING
      `;
    }
  }, { timeout: 120_000 });

  const insertedIds = groupRows.map((g) => g.id);
  await prisma.$executeRaw`
    UPDATE "Group" g
    SET
      "memberCount" = stats.member_count,
      "memberHash" = stats.member_hash
    FROM (
      SELECT
        g.id,
        COUNT(pg."postId")::INTEGER AS member_count,
        CASE
          WHEN COUNT(pg."postId") > 0
            THEN MD5(STRING_AGG(pg."postId"::text, ',' ORDER BY pg."postId"))
          ELSE NULL
        END AS member_hash
      FROM "Group" g
      LEFT JOIN "PostGroup" pg ON pg."groupId" = g.id
      WHERE g.id = ANY(${insertedIds}::int[])
      GROUP BY g.id
    ) stats
    WHERE g.id = stats.id
  `;

  // Translations for ~30% of titled groups; contentHash must equal the
  // generated Group.titleHash (sha256 of the title's UTF-8 bytes).
  const titled = groupRows.filter((g) => g.title !== null);
  const translated = titled.filter(() => rng() < 0.3);
  const hashes = translated.map((g) => sha256Hex(g.title as string));
  const translations = translated.map((g) => `translated ${g.title} ${noteContent(rng, 2)}`);
  for (let i = 0; i < translated.length; i += INSERT_BATCH) {
    await prisma.$executeRaw`
      INSERT INTO "ContentTranslation" ("contentHash", "translatedContent", "sourceLanguage", "targetLanguage")
      SELECT hash, body, 'ja', 'en'
      FROM unnest(
        ${hashes.slice(i, i + INSERT_BATCH)}::text[],
        ${translations.slice(i, i + INSERT_BATCH)}::text[]
      ) AS t(hash, body)
      ON CONFLICT DO NOTHING
    `;
  }

  console.log(`  Groups seeded in ${((performance.now() - startTime) / 1000).toFixed(1)}s`);
  return {
    groupCount,
    membershipCount: memberGroupIds.length,
    translationCount: translated.length,
  };
}

/**
 * Get random existing tag names from the database.
 *
 * Pass maxPostCount to select mid-frequency tags: with Zipf-distributed
 * seeding the most popular tags sit on a majority of posts, where a
 * sequential scan can be the genuinely optimal plan — plan guards should
 * target the representative mid-band instead.
 */
export async function getRandomTagNames(
  prisma: PrismaClient,
  count: number,
  minPostCount = 10,
  maxPostCount?: number
): Promise<string[]> {
  const tags = await prisma.tag.findMany({
    where: {
      postCount: {
        gte: minPostCount,
        ...(maxPostCount !== undefined && { lte: maxPostCount }),
      },
    },
    select: { name: true },
    orderBy: { postCount: 'desc' },
    take: count * 3, // Get extra to have selection pool
  });

  return pickRandom(tags.map(t => t.name), count);
}
