import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { createPost, randomHash } from '../factories';
// Static route import is safe here: @/lib/db's prisma is a Proxy resolving the
// test client per property access, and this module does no top-level DB work.
import * as viewRoute from '@/app/api/posts/[hash]/view/route';

function makeParams(hash: string) {
  return { params: Promise.resolve({ hash }) };
}

function post(url: string) {
  return new NextRequest(url, { method: 'POST' });
}

describe('view route (Integration)', () => {
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

  it('POST records a first view with count 1 and returns recorded: true', async () => {
    const prisma = getTestPrisma();
    const created = await createPost(prisma);

    const response = await viewRoute.POST(
      post(`http://localhost/api/posts/${created.hash}/view`),
      makeParams(created.hash)
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ recorded: true });

    const rows = await prisma.postView.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].postId).toBe(created.id);
    expect(rows[0].viewCount).toBe(1);
  });

  it('repeated POSTs increment viewCount and advance lastViewedAt', async () => {
    const prisma = getTestPrisma();
    const created = await createPost(prisma);
    const url = `http://localhost/api/posts/${created.hash}/view`;

    await viewRoute.POST(post(url), makeParams(created.hash));
    const first = await prisma.postView.findUniqueOrThrow({ where: { postId: created.id } });

    await viewRoute.POST(post(url), makeParams(created.hash));
    const second = await viewRoute.POST(post(url), makeParams(created.hash));
    expect(second.status).toBe(200);

    const after = await prisma.postView.findUniqueOrThrow({ where: { postId: created.id } });
    expect(after.viewCount).toBe(3);
    // firstViewedAt is pinned; lastViewedAt only moves forward.
    expect(after.firstViewedAt.getTime()).toBe(first.firstViewedAt.getTime());
    expect(after.lastViewedAt.getTime()).toBeGreaterThanOrEqual(first.lastViewedAt.getTime());
  });

  it('rejects an invalid hash with 400 and records nothing', async () => {
    const prisma = getTestPrisma();
    const badHash = 'not-a-hash';

    const response = await viewRoute.POST(
      post(`http://localhost/api/posts/${badHash}/view`),
      makeParams(badHash)
    );
    expect(response.status).toBe(400);
    expect(await prisma.postView.count()).toBe(0);
  });

  it('returns 404 for an unknown post and records nothing', async () => {
    const prisma = getTestPrisma();
    const missingHash = randomHash();

    const response = await viewRoute.POST(
      post(`http://localhost/api/posts/${missingHash}/view`),
      makeParams(missingHash)
    );
    expect(response.status).toBe(404);
    expect(await prisma.postView.count()).toBe(0);
  });

  it('normalizes an uppercase hash to the stored lowercase post', async () => {
    const prisma = getTestPrisma();
    const created = await createPost(prisma);
    const upper = created.hash.toUpperCase();

    const response = await viewRoute.POST(
      post(`http://localhost/api/posts/${upper}/view`),
      makeParams(upper)
    );
    expect(response.status).toBe(200);

    const rows = await prisma.postView.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].postId).toBe(created.id);
  });
});
