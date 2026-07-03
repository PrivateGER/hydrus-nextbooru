import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { createPostWithTags } from '../factories';
import { invalidateFeedCache } from '@/lib/feed';
import * as feedRoute from '@/app/api/feed/route';
import * as favoriteRoute from '@/app/api/posts/[hash]/favorite/route';
import * as dismissalRoute from '@/app/api/posts/[hash]/dismissal/route';

const TASTE_TAGS = ['1girl', 'blue hair', 'school uniform'];

function get(url: string) {
  return new NextRequest(url);
}

async function favorite(hash: string) {
  const response = await favoriteRoute.PUT(
    new NextRequest(`http://localhost/api/posts/${hash}/favorite`, { method: 'PUT' }),
    { params: Promise.resolve({ hash }) }
  );
  expect(response.status).toBe(200);
}

async function dismiss(hash: string) {
  const response = await dismissalRoute.PUT(
    new NextRequest(`http://localhost/api/posts/${hash}/dismissal`, { method: 'PUT' }),
    { params: Promise.resolve({ hash }) }
  );
  expect(response.status).toBe(200);
}

async function fetchFeed() {
  const response = await feedRoute.GET(get('http://localhost/api/feed'));
  expect(response.status).toBe(200);
  return response.json();
}

describe('GET /api/feed (Integration)', () => {
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
    invalidateFeedCache();
  });

  it('returns an empty feed with no favorites (cold start)', async () => {
    await createPostWithTags(getTestPrisma(), TASTE_TAGS);

    const data = await fetchFeed();
    expect(data.posts).toEqual([]);
    expect(data.totalCount).toBe(0);
    expect(data.totalPages).toBe(0);
  });

  it('recommends tag-similar posts and never the favorites themselves', async () => {
    const prisma = getTestPrisma();
    const seed = await createPostWithTags(prisma, TASTE_TAGS);
    const similar = await createPostWithTags(prisma, TASTE_TAGS);
    const unrelated = await createPostWithTags(prisma, ['landscape photo', 'mountain']);
    // IDF weights are precomputed in production by sync; set them directly here.
    await prisma.tag.updateMany({ data: { idfWeight: 1.0 } });

    await favorite(seed.hash);
    const data = await fetchFeed();

    const hashes = data.posts.map((p: { hash: string }) => p.hash);
    expect(hashes).toContain(similar.hash);
    expect(hashes).not.toContain(seed.hash);
    expect(hashes).not.toContain(unrelated.hash);
    expect(data.posts[0].score).toBeGreaterThan(0);
  });

  it('favoriting invalidates the cached feed', async () => {
    const prisma = getTestPrisma();
    const seed = await createPostWithTags(prisma, TASTE_TAGS);
    const similar = await createPostWithTags(prisma, TASTE_TAGS);
    await prisma.tag.updateMany({ data: { idfWeight: 1.0 } });

    // Build (and cache) an empty feed first
    const before = await fetchFeed();
    expect(before.posts).toEqual([]);

    await favorite(seed.hash);
    const after = await fetchFeed();
    expect(after.posts.map((p: { hash: string }) => p.hash)).toContain(similar.hash);
  });

  it('dismissed posts never appear in the feed', async () => {
    const prisma = getTestPrisma();
    const seed = await createPostWithTags(prisma, TASTE_TAGS);
    const similar = await createPostWithTags(prisma, TASTE_TAGS);
    await prisma.tag.updateMany({ data: { idfWeight: 1.0 } });

    await favorite(seed.hash);
    await dismiss(similar.hash);

    const data = await fetchFeed();
    expect(data.posts.map((p: { hash: string }) => p.hash)).not.toContain(similar.hash);
  });

  it('excludes group siblings of seeds', async () => {
    const prisma = getTestPrisma();
    const seed = await createPostWithTags(prisma, TASTE_TAGS);
    const sibling = await createPostWithTags(prisma, TASTE_TAGS);
    const outsider = await createPostWithTags(prisma, TASTE_TAGS);
    await prisma.tag.updateMany({ data: { idfWeight: 1.0 } });

    const group = await prisma.group.create({
      data: { sourceType: 'PIXIV', sourceId: 'feed-test-group' },
    });
    await prisma.postGroup.createMany({
      data: [
        { postId: seed.id, groupId: group.id, position: 0 },
        { postId: sibling.id, groupId: group.id, position: 1 },
      ],
    });

    await favorite(seed.hash);
    const data = await fetchFeed();

    const hashes = data.posts.map((p: { hash: string }) => p.hash);
    expect(hashes).not.toContain(sibling.hash);
    expect(hashes).toContain(outsider.hash);
  });
});
