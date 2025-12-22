import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from '@/test/integration/setup';
import { setTestPrisma } from '@/lib/db';
import { createPost } from '@/test/integration/factories';
import { getRecommendedPosts } from './recommendations';
import { TagCategory } from '@/generated/prisma/client';

describe('getRecommendedPosts (Integration)', () => {
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

  it('should return empty array when post has no tags', async () => {
    const prisma = getTestPrisma();
    const post = await createPost(prisma);

    const result = await getRecommendedPosts(post.id);

    expect(result).toEqual([]);
  });

  it('should recommend posts with shared tags and calculate Jaccard similarity', async () => {
    const prisma = getTestPrisma();

    // Create tags
    const tag1 = await prisma.tag.create({
      data: { name: 'blue eyes', category: TagCategory.GENERAL },
    });
    const tag2 = await prisma.tag.create({
      data: { name: 'blonde hair', category: TagCategory.GENERAL },
    });

    // Create current post with 2 tags: [tag1, tag2]
    const currentPost = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: currentPost.id, tagId: tag1.id },
    });
    await prisma.postTag.create({
      data: { postId: currentPost.id, tagId: tag2.id },
    });

    // Create recommended post with 1 shared tag: [tag1]
    // Jaccard similarity = 1 / (2 + 1 - 1) = 1/2 = 0.5
    const recommendedPost = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: recommendedPost.id, tagId: tag1.id },
    });

    const result = await getRecommendedPosts(currentPost.id);

    expect(result).toHaveLength(1);
    expect(result[0].hash).toBe(recommendedPost.hash);
    expect(result[0].sharedTagCount).toBe(1);
    expect(result[0].similarity).toBeCloseTo(0.5, 2);
  });

  it('should rank posts by Jaccard similarity', async () => {
    const prisma = getTestPrisma();

    // Create tags
    const tags = await Promise.all([
      prisma.tag.create({ data: { name: 'tag1', category: TagCategory.GENERAL } }),
      prisma.tag.create({ data: { name: 'tag2', category: TagCategory.GENERAL } }),
      prisma.tag.create({ data: { name: 'tag3', category: TagCategory.GENERAL } }),
      prisma.tag.create({ data: { name: 'tag4', category: TagCategory.GENERAL } }),
    ]);

    // Current post has 3 tags: [tag1, tag2, tag3]
    const currentPost = await createPost(prisma);
    for (let i = 0; i < 3; i++) {
      await prisma.postTag.create({
        data: { postId: currentPost.id, tagId: tags[i].id },
      });
    }

    // Post A: 2 shared tags out of 2 total: [tag1, tag2]
    // Jaccard = 2 / (3 + 2 - 2) = 2/3 ≈ 0.667
    const postA = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: postA.id, tagId: tags[0].id },
    });
    await prisma.postTag.create({
      data: { postId: postA.id, tagId: tags[1].id },
    });

    // Post B: 2 shared tags out of 4 total: [tag1, tag2, tag4, extra]
    // Jaccard = 2 / (3 + 4 - 2) = 2/5 = 0.4
    const postB = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: postB.id, tagId: tags[0].id },
    });
    await prisma.postTag.create({
      data: { postId: postB.id, tagId: tags[1].id },
    });
    await prisma.postTag.create({
      data: { postId: postB.id, tagId: tags[3].id },
    });
    const extraTag = await prisma.tag.create({
      data: { name: 'extra', category: TagCategory.GENERAL },
    });
    await prisma.postTag.create({
      data: { postId: postB.id, tagId: extraTag.id },
    });

    const result = await getRecommendedPosts(currentPost.id);

    expect(result).toHaveLength(2);
    // Post A should rank higher despite both having 2 shared tags
    expect(result[0].hash).toBe(postA.hash);
    expect(result[0].sharedTagCount).toBe(2);
    expect(result[0].similarity).toBeCloseTo(0.667, 2);

    expect(result[1].hash).toBe(postB.hash);
    expect(result[1].sharedTagCount).toBe(2);
    expect(result[1].similarity).toBeCloseTo(0.4, 2);
  });

  it('should exclude posts with perfect tag overlap', async () => {
    const prisma = getTestPrisma();

    // Create tags
    const tags = await Promise.all([
      prisma.tag.create({ data: { name: 'tag1', category: TagCategory.GENERAL } }),
      prisma.tag.create({ data: { name: 'tag2', category: TagCategory.GENERAL } }),
    ]);

    // Current post has tags 1 and 2
    const currentPost = await createPost(prisma);
    for (const tag of tags) {
      await prisma.postTag.create({
        data: { postId: currentPost.id, tagId: tag.id },
      });
    }

    // Perfect overlap post (same tags, should be excluded)
    const perfectOverlapPost = await createPost(prisma);
    for (const tag of tags) {
      await prisma.postTag.create({
        data: { postId: perfectOverlapPost.id, tagId: tag.id },
      });
    }

    // Partial overlap post (has tag1 and additional tag3, should be included)
    const tag3 = await prisma.tag.create({
      data: { name: 'tag3', category: TagCategory.GENERAL },
    });
    const partialOverlapPost = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: partialOverlapPost.id, tagId: tags[0].id },
    });
    await prisma.postTag.create({
      data: { postId: partialOverlapPost.id, tagId: tag3.id },
    });

    const result = await getRecommendedPosts(currentPost.id);

    // Should only include partial overlap, not perfect overlap
    expect(result).toHaveLength(1);
    expect(result[0].hash).toBe(partialOverlapPost.hash);
  });

  it('should exclude posts in the same groups', async () => {
    const prisma = getTestPrisma();

    // Create a tag
    const tag = await prisma.tag.create({
      data: { name: 'shared tag', category: TagCategory.GENERAL },
    });

    // Create current post with tag
    const currentPost = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: currentPost.id, tagId: tag.id },
    });

    // Create a group and add current post
    const group = await prisma.group.create({
      data: { sourceType: 'PIXIV', sourceId: '12345' },
    });
    await prisma.postGroup.create({
      data: { postId: currentPost.id, groupId: group.id, position: 0 },
    });

    // Create another post in the same group (should be excluded)
    const postInGroup = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: postInGroup.id, tagId: tag.id },
    });
    await prisma.postGroup.create({
      data: { postId: postInGroup.id, groupId: group.id, position: 1 },
    });

    // Create a post not in the group (should be included)
    const postNotInGroup = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: postNotInGroup.id, tagId: tag.id },
    });

    const result = await getRecommendedPosts(currentPost.id, [group.id]);

    // Should only include the post not in the group
    expect(result).toHaveLength(1);
    expect(result[0].hash).toBe(postNotInGroup.hash);
  });

  it('should limit results to 12 posts', async () => {
    const prisma = getTestPrisma();

    // Create a tag
    const tag = await prisma.tag.create({
      data: { name: 'popular tag', category: TagCategory.GENERAL },
    });

    // Current post
    const currentPost = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: currentPost.id, tagId: tag.id },
    });

    // Create 20 posts with the same tag
    for (let i = 0; i < 20; i++) {
      const post = await createPost(prisma);
      await prisma.postTag.create({
        data: { postId: post.id, tagId: tag.id },
      });
    }

    const result = await getRecommendedPosts(currentPost.id);

    // Should be limited to 12 results
    expect(result).toHaveLength(12);
  });

  it('should return all required fields', async () => {
    const prisma = getTestPrisma();

    // Create tag and posts
    const tag = await prisma.tag.create({
      data: { name: 'test tag', category: TagCategory.GENERAL },
    });

    const currentPost = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: currentPost.id, tagId: tag.id },
    });

    const recommendedPost = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: recommendedPost.id, tagId: tag.id },
    });

    const result = await getRecommendedPosts(currentPost.id);

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('id');
    expect(result[0]).toHaveProperty('hash');
    expect(result[0]).toHaveProperty('width');
    expect(result[0]).toHaveProperty('height');
    expect(result[0]).toHaveProperty('mimeType');
    expect(result[0]).toHaveProperty('similarity');
    expect(result[0]).toHaveProperty('sharedTagCount');
    expect(typeof result[0].id).toBe('number');
    expect(typeof result[0].hash).toBe('string');
    expect(typeof result[0].mimeType).toBe('string');
    expect(typeof result[0].similarity).toBe('number');
    expect(typeof result[0].sharedTagCount).toBe('number');
  });

  it('should handle posts with different tag categories', async () => {
    const prisma = getTestPrisma();

    // Create tags of different categories
    const generalTag = await prisma.tag.create({
      data: { name: 'blue eyes', category: TagCategory.GENERAL },
    });
    const artistTag = await prisma.tag.create({
      data: { name: 'artist_name', category: TagCategory.ARTIST },
    });
    const characterTag = await prisma.tag.create({
      data: { name: 'character_name', category: TagCategory.CHARACTER },
    });

    // Current post has all three: [general, artist, character]
    const currentPost = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: currentPost.id, tagId: generalTag.id },
    });
    await prisma.postTag.create({
      data: { postId: currentPost.id, tagId: artistTag.id },
    });
    await prisma.postTag.create({
      data: { postId: currentPost.id, tagId: characterTag.id },
    });

    // Recommended post shares artist and character (2 out of 2 tags)
    // Jaccard = 2 / (3 + 2 - 2) = 2/3 ≈ 0.667
    const recommendedPost = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: recommendedPost.id, tagId: artistTag.id },
    });
    await prisma.postTag.create({
      data: { postId: recommendedPost.id, tagId: characterTag.id },
    });

    const result = await getRecommendedPosts(currentPost.id);

    expect(result).toHaveLength(1);
    expect(result[0].hash).toBe(recommendedPost.hash);
    expect(result[0].sharedTagCount).toBe(2);
    expect(result[0].similarity).toBeCloseTo(0.667, 2);
  });

  it('should not recommend the current post itself', async () => {
    const prisma = getTestPrisma();

    // Create tag
    const tag = await prisma.tag.create({
      data: { name: 'test tag', category: TagCategory.GENERAL },
    });

    // Current post
    const currentPost = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: currentPost.id, tagId: tag.id },
    });

    const result = await getRecommendedPosts(currentPost.id);

    // Should not include the current post itself
    expect(result).toHaveLength(0);
  });

  it('should filter out posts below minimum similarity threshold (15%)', async () => {
    const prisma = getTestPrisma();

    // Create many tags
    const tags = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        prisma.tag.create({
          data: { name: `tag${i}`, category: TagCategory.GENERAL },
        })
      )
    );

    // Current post has 10 tags
    const currentPost = await createPost(prisma);
    for (const tag of tags) {
      await prisma.postTag.create({
        data: { postId: currentPost.id, tagId: tag.id },
      });
    }

    // Post with low similarity: 1 shared tag out of 10 total
    // Jaccard = 1 / (10 + 10 - 1) = 1/19 ≈ 0.053 (below 0.15 threshold)
    const lowSimilarityPost = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: lowSimilarityPost.id, tagId: tags[0].id },
    });
    for (let i = 0; i < 9; i++) {
      const extraTag = await prisma.tag.create({
        data: { name: `extra${i}`, category: TagCategory.GENERAL },
      });
      await prisma.postTag.create({
        data: { postId: lowSimilarityPost.id, tagId: extraTag.id },
      });
    }

    // Post with acceptable similarity: 2 shared tags out of 5 total
    // Jaccard = 2 / (10 + 5 - 2) = 2/13 ≈ 0.154 (above 0.15 threshold)
    const acceptablePost = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: acceptablePost.id, tagId: tags[0].id },
    });
    await prisma.postTag.create({
      data: { postId: acceptablePost.id, tagId: tags[1].id },
    });
    for (let i = 0; i < 3; i++) {
      const extraTag = await prisma.tag.create({
        data: { name: `ok${i}`, category: TagCategory.GENERAL },
      });
      await prisma.postTag.create({
        data: { postId: acceptablePost.id, tagId: extraTag.id },
      });
    }

    const result = await getRecommendedPosts(currentPost.id);

    // Should only include post with similarity >= 0.15
    expect(result).toHaveLength(1);
    expect(result[0].hash).toBe(acceptablePost.hash);
    expect(result[0].similarity).toBeGreaterThanOrEqual(0.15);
  });

  it('should correctly calculate Jaccard similarity edge cases', async () => {
    const prisma = getTestPrisma();

    // Create tags
    const tag1 = await prisma.tag.create({
      data: { name: 'tag1', category: TagCategory.GENERAL },
    });
    const tag2 = await prisma.tag.create({
      data: { name: 'tag2', category: TagCategory.GENERAL },
    });

    // Current post: [tag1, tag2]
    const currentPost = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: currentPost.id, tagId: tag1.id },
    });
    await prisma.postTag.create({
      data: { postId: currentPost.id, tagId: tag2.id },
    });

    // Test case: 100% shared but different total (should not be perfect match)
    // Candidate: [tag1, tag2, tag3]
    // Jaccard = 2 / (2 + 3 - 2) = 2/3 ≈ 0.667
    const tag3 = await prisma.tag.create({
      data: { name: 'tag3', category: TagCategory.GENERAL },
    });
    const candidatePost = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: candidatePost.id, tagId: tag1.id },
    });
    await prisma.postTag.create({
      data: { postId: candidatePost.id, tagId: tag2.id },
    });
    await prisma.postTag.create({
      data: { postId: candidatePost.id, tagId: tag3.id },
    });

    const result = await getRecommendedPosts(currentPost.id);

    expect(result).toHaveLength(1);
    expect(result[0].hash).toBe(candidatePost.hash);
    expect(result[0].similarity).toBeCloseTo(0.667, 2);
  });

  it('should filter out very common tags (>1000 posts) for better discrimination', async () => {
    const prisma = getTestPrisma();

    // Create a very common tag (e.g., "1girl")
    const massiveTag = await prisma.tag.create({
      data: { name: '1girl', category: TagCategory.GENERAL, postCount: 5000 },
    });

    // Create a discriminating tag
    const discriminatingTag = await prisma.tag.create({
      data: { name: 'rare_character', category: TagCategory.CHARACTER, postCount: 10 },
    });

    // Current post has both massive and discriminating tags
    const currentPost = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: currentPost.id, tagId: massiveTag.id },
    });
    await prisma.postTag.create({
      data: { postId: currentPost.id, tagId: discriminatingTag.id },
    });

    // Candidate A: Only shares the massive tag (should be filtered out)
    const candidateA = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: candidateA.id, tagId: massiveTag.id },
    });

    // Candidate B: Shares the discriminating tag (should be included)
    const candidateB = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: candidateB.id, tagId: discriminatingTag.id },
    });

    const result = await getRecommendedPosts(currentPost.id);

    // Should only include candidate B (shares discriminating tag)
    // Candidate A is filtered out because it only shares massive tag
    expect(result).toHaveLength(1);
    expect(result[0].hash).toBe(candidateB.hash);
  });

  it('should handle posts with only massive tags gracefully', async () => {
    const prisma = getTestPrisma();

    // Create only massive tags
    const massiveTag1 = await prisma.tag.create({
      data: { name: '1girl', category: TagCategory.GENERAL, postCount: 5000 },
    });
    const massiveTag2 = await prisma.tag.create({
      data: { name: 'solo', category: TagCategory.GENERAL, postCount: 3000 },
    });

    // Current post has only massive tags
    const currentPost = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: currentPost.id, tagId: massiveTag1.id },
    });
    await prisma.postTag.create({
      data: { postId: currentPost.id, tagId: massiveTag2.id },
    });

    // Candidate with same massive tags
    const candidate = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: candidate.id, tagId: massiveTag1.id },
    });

    const result = await getRecommendedPosts(currentPost.id);

    // Should return empty since all tags are filtered out
    expect(result).toEqual([]);
  });
});
