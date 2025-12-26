/**
 * Large dataset seeders for performance tests
 */

import { PrismaClient, TagCategory } from '@/generated/prisma/client';
import { createPostsBulk, createTagsBulk, linkPostsToTagsBulk } from '../integration/factories';

/**
 * Pick random items from an array
 */
function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
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
 * Creates tags and posts with realistic distribution.
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
  } = config;

  console.log(`Seeding dataset: ${posts} posts, ${uniqueTags} tags, ~${tagsPerPost} tags/post`);
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

  // Step 2: Create posts in batches with tags using bulk factories
  const BATCH_SIZE = 5000;
  let createdPosts = 0;

  for (let batch = 0; batch < posts; batch += BATCH_SIZE) {
    const batchSize = Math.min(BATCH_SIZE, posts - batch);

    // Use bulk factory for posts
    const postIds = await createPostsBulk(prisma, batchSize);

    // Build post-tag relations
    const postTagData: { postId: number; tagId: number }[] = [];
    for (const postId of postIds) {
      const tagCount = tagsPerPost + Math.floor(Math.random() * 10) - 5; // ±5 variance
      const selectedTags = pickRandom(allTags, Math.max(1, tagCount));

      for (const tag of selectedTags) {
        postTagData.push({ postId, tagId: tag.id });
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
 * Seed dataset based on PERF_DATASET_SIZE environment variable.
 * Defaults to 'medium' if not set.
 */
export async function seedDataset(prisma: PrismaClient): Promise<{ tagCount: number; postCount: number }> {
  const size = process.env.PERF_DATASET_SIZE || 'medium';

  switch (size) {
    case 'large':
      return seedLargeDataset(prisma);
    case 'small':
      return seedSmallDataset(prisma);
    case 'medium':
    default:
      return seedMediumDataset(prisma);
  }
}

/**
 * Get random existing tag names from the database
 */
export async function getRandomTagNames(
  prisma: PrismaClient,
  count: number,
  minPostCount = 10
): Promise<string[]> {
  const tags = await prisma.tag.findMany({
    where: { postCount: { gte: minPostCount } },
    select: { name: true },
    orderBy: { postCount: 'desc' },
    take: count * 3, // Get extra to have selection pool
  });

  return pickRandom(tags.map(t => t.name), count);
}
