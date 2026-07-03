import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { createPost, randomHash } from '../factories';
import * as favoriteRoute from '@/app/api/posts/[hash]/favorite/route';
import * as dismissalRoute from '@/app/api/posts/[hash]/dismissal/route';

function makeParams(hash: string) {
  return { params: Promise.resolve({ hash }) };
}

function put(url: string) {
  return new NextRequest(url, { method: 'PUT' });
}

function del(url: string) {
  return new NextRequest(url, { method: 'DELETE' });
}

describe('favorite/dismissal routes (Integration)', () => {
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

  it('PUT favorite creates a favorite and returns favorited: true', async () => {
    const prisma = getTestPrisma();
    const post = await createPost(prisma);

    const response = await favoriteRoute.PUT(
      put(`http://localhost/api/posts/${post.hash}/favorite`),
      makeParams(post.hash)
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ favorited: true });

    const rows = await prisma.favorite.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].postId).toBe(post.id);
  });

  it('PUT favorite is idempotent', async () => {
    const prisma = getTestPrisma();
    const post = await createPost(prisma);
    const url = `http://localhost/api/posts/${post.hash}/favorite`;

    await favoriteRoute.PUT(put(url), makeParams(post.hash));
    const second = await favoriteRoute.PUT(put(url), makeParams(post.hash));

    expect(second.status).toBe(200);
    expect(await prisma.favorite.count()).toBe(1);
  });

  it('DELETE favorite removes the row and is idempotent when absent', async () => {
    const prisma = getTestPrisma();
    const post = await createPost(prisma);
    const url = `http://localhost/api/posts/${post.hash}/favorite`;

    await favoriteRoute.PUT(put(url), makeParams(post.hash));
    const removed = await favoriteRoute.DELETE(del(url), makeParams(post.hash));
    expect(removed.status).toBe(200);
    expect(await removed.json()).toEqual({ favorited: false });
    expect(await prisma.favorite.count()).toBe(0);

    // Deleting again succeeds (idempotent)
    const again = await favoriteRoute.DELETE(del(url), makeParams(post.hash));
    expect(again.status).toBe(200);
  });

  it('rejects invalid hash with 400 and unknown post with 404', async () => {
    const badHash = 'not-a-hash';
    const badResponse = await favoriteRoute.PUT(
      put(`http://localhost/api/posts/${badHash}/favorite`),
      makeParams(badHash)
    );
    expect(badResponse.status).toBe(400);

    const missingHash = randomHash();
    const missing = await favoriteRoute.PUT(
      put(`http://localhost/api/posts/${missingHash}/favorite`),
      makeParams(missingHash)
    );
    expect(missing.status).toBe(404);
  });

  it('favoriting removes an existing dismissal (mutual exclusion)', async () => {
    const prisma = getTestPrisma();
    const post = await createPost(prisma);

    await dismissalRoute.PUT(
      put(`http://localhost/api/posts/${post.hash}/dismissal`),
      makeParams(post.hash)
    );
    expect(await prisma.feedDismissal.count()).toBe(1);

    await favoriteRoute.PUT(
      put(`http://localhost/api/posts/${post.hash}/favorite`),
      makeParams(post.hash)
    );

    expect(await prisma.favorite.count()).toBe(1);
    expect(await prisma.feedDismissal.count()).toBe(0);
  });

  it('dismissing removes an existing favorite (mutual exclusion)', async () => {
    const prisma = getTestPrisma();
    const post = await createPost(prisma);

    await favoriteRoute.PUT(
      put(`http://localhost/api/posts/${post.hash}/favorite`),
      makeParams(post.hash)
    );
    await dismissalRoute.PUT(
      put(`http://localhost/api/posts/${post.hash}/dismissal`),
      makeParams(post.hash)
    );

    expect(await prisma.favorite.count()).toBe(0);
    expect(await prisma.feedDismissal.count()).toBe(1);
  });

  it('uppercase hashes are normalized', async () => {
    const prisma = getTestPrisma();
    const post = await createPost(prisma);
    const upper = post.hash.toUpperCase();

    const response = await favoriteRoute.PUT(
      put(`http://localhost/api/posts/${upper}/favorite`),
      makeParams(upper)
    );
    expect(response.status).toBe(200);
    expect(await prisma.favorite.count()).toBe(1);
  });
});
