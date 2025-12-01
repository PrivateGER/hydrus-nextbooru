/**
 * Large dataset seeders for performance tests
 */

import { PrismaClient, TagCategory, Rating, ThumbnailStatus } from '@/generated/prisma/client';

/**
 * Generate a random 64-character hex hash
 */
function randomHash(): string {
  return Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

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

  // Step 1: Create tags by category
  const tagsByCategory = new Map<TagCategory, { id: number; name: string }[]>();
  const allTags: { id: number; name: string; category: TagCategory }[] = [];

  for (const category of Object.values(TagCategory)) {
    const count = Math.floor(uniqueTags * categoryDistribution[category]);
    const categoryTags: { name: string; category: TagCategory }[] = [];

    for (let i = 0; i < count; i++) {
      categoryTags.push({
        name: `${category.toLowerCase()}_tag_${i}`,
        category,
      });
    }

    // Batch insert tags
    await prisma.tag.createMany({
      data: categoryTags,
      skipDuplicates: true,
    });

    // Fetch back to get IDs
    const created = await prisma.tag.findMany({
      where: { category },
      select: { id: true, name: true, category: true },
    });

    tagsByCategory.set(category, created);
    allTags.push(...created);
  }

  console.log(`  Created ${allTags.length} tags in ${((performance.now() - startTime) / 1000).toFixed(1)}s`);

  // Step 2: Create posts in batches with tags
  const BATCH_SIZE = 2000;
  let createdPosts = 0;

  // Pre-allocate PostTag data for bulk insert
  const postTagBatches: { postId: number; tagId: number }[][] = [];

  for (let batch = 0; batch < posts; batch += BATCH_SIZE) {
    const batchSize = Math.min(BATCH_SIZE, posts - batch);
    const postData: {
      hash: string;
      hydrusFileId: number;
      mimeType: string;
      extension: string;
      fileSize: number;
      width: number;
      height: number;
      rating: Rating;
      importedAt: Date;
      thumbnailStatus: ThumbnailStatus;
    }[] = [];

    for (let i = 0; i < batchSize; i++) {
      postData.push({
        hash: randomHash(),
        hydrusFileId: batch + i + 1,
        mimeType: 'image/png',
        extension: '.png',
        fileSize: Math.floor(Math.random() * 5000000) + 100000,
        width: Math.floor(Math.random() * 3000) + 500,
        height: Math.floor(Math.random() * 3000) + 500,
        rating: Rating.UNRATED,
        importedAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
        thumbnailStatus: ThumbnailStatus.PENDING,
      });
    }

    // Insert posts
    await prisma.post.createMany({ data: postData });

    // Fetch created posts to get IDs
    const createdBatch = await prisma.post.findMany({
      where: {
        hydrusFileId: { gte: batch + 1, lte: batch + batchSize },
      },
      select: { id: true },
      orderBy: { hydrusFileId: 'asc' },
    });

    // Assign tags to posts
    const postTagData: { postId: number; tagId: number }[] = [];
    for (const post of createdBatch) {
      const tagCount = tagsPerPost + Math.floor(Math.random() * 10) - 5; // ±5 variance
      const selectedTags = pickRandom(allTags, Math.max(1, tagCount));

      for (const tag of selectedTags) {
        postTagData.push({ postId: post.id, tagId: tag.id });
      }
    }

    // Bulk insert post-tag relations
    await prisma.postTag.createMany({
      data: postTagData,
      skipDuplicates: true,
    });

    createdPosts += batchSize;

    if (createdPosts % 2000 === 0) {
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
