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

  it('should recommend posts with shared tags', async () => {
    const prisma = getTestPrisma();

    // Create tags
    const tag1 = await prisma.tag.create({
      data: { name: 'blue eyes', category: TagCategory.GENERAL },
    });
    const tag2 = await prisma.tag.create({
      data: { name: 'blonde hair', category: TagCategory.GENERAL },
    });

    // Create current post with tags
    const currentPost = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: currentPost.id, tagId: tag1.id },
    });
    await prisma.postTag.create({
      data: { postId: currentPost.id, tagId: tag2.id },
    });

    // Create recommended post with shared tag
    const recommendedPost = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: recommendedPost.id, tagId: tag1.id },
    });

    const result = await getRecommendedPosts(currentPost.id);

    expect(result).toHaveLength(1);
    expect(result[0].hash).toBe(recommendedPost.hash);
    expect(result[0].sharedTagCount).toBe(1);
  });

  it('should score posts by number of shared tags', async () => {
    const prisma = getTestPrisma();

    // Create tags
    const tags = await Promise.all([
      prisma.tag.create({ data: { name: 'tag1', category: TagCategory.GENERAL } }),
      prisma.tag.create({ data: { name: 'tag2', category: TagCategory.GENERAL } }),
      prisma.tag.create({ data: { name: 'tag3', category: TagCategory.GENERAL } }),
    ]);

    // Current post has all 3 tags
    const currentPost = await createPost(prisma);
    for (const tag of tags) {
      await prisma.postTag.create({
        data: { postId: currentPost.id, tagId: tag.id },
      });
    }

    // Post with 1 shared tag
    const post1Tag = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: post1Tag.id, tagId: tags[0].id },
    });

    // Post with 2 shared tags (should rank higher)
    const post2Tags = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: post2Tags.id, tagId: tags[0].id },
    });
    await prisma.postTag.create({
      data: { postId: post2Tags.id, tagId: tags[1].id },
    });

    const result = await getRecommendedPosts(currentPost.id);

    expect(result).toHaveLength(2);
    // Post with 2 shared tags should come first
    expect(result[0].hash).toBe(post2Tags.hash);
    expect(result[0].sharedTagCount).toBe(2);
    expect(result[1].hash).toBe(post1Tag.hash);
    expect(result[1].sharedTagCount).toBe(1);
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
    expect(result[0]).toHaveProperty('sharedTagCount');
    expect(typeof result[0].id).toBe('number');
    expect(typeof result[0].hash).toBe('string');
    expect(typeof result[0].mimeType).toBe('string');
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

    // Current post has all three
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

    // Recommended post shares artist and character (2 tags)
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
});
