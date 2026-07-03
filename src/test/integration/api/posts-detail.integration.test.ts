import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { invalidateAllCaches } from '@/lib/cache';
import {
  createGroup,
  createNote,
  createPost,
  createPostWithTags,
} from '../factories';
import { Rating, SourceType, TagCategory } from '@/generated/prisma/client';

let GET: typeof import('@/app/api/posts/[hash]/route').GET;

describe('GET /api/posts/[hash] (Integration)', () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);
    const routeModule = await import('@/app/api/posts/[hash]/route');
    GET = routeModule.GET;
  });

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
    invalidateAllCaches();
  });

  it('returns rich companion app post detail data with media URLs and group navigation', async () => {
    const prisma = getTestPrisma();
    const previous = await createPost(prisma, { extension: '.jpg', mimeType: 'image/jpeg' });
    const post = await createPostWithTags(
      prisma,
      [
        { name: 'alice', category: TagCategory.ARTIST },
        { name: 'blue eyes', category: TagCategory.GENERAL },
      ],
      {
        extension: '.webp',
        mimeType: 'image/webp',
        width: 1200,
        height: 1600,
        fileSize: 456789,
        rating: Rating.SAFE,
        blurhash: 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH',
        sourceUrls: ['https://example.test/source'],
      }
    );
    const next = await createPost(prisma, { extension: '.png', mimeType: 'image/png' });
    await createNote(prisma, post.id, {
      name: 'caption',
      content: 'hello world',
      translatedContent: 'hallo welt',
      sourceLanguage: 'en',
      targetLanguage: 'de',
    });
    const group = await createGroup(prisma, SourceType.PIXIV, '12345', 'Pixiv set');
    await prisma.postGroup.createMany({
      data: [
        { postId: previous.id, groupId: group.id, position: 0 },
        { postId: post.id, groupId: group.id, position: 1 },
        { postId: next.id, groupId: group.id, position: 2 },
      ],
    });

    const response = await GET(
      new NextRequest(`http://localhost/api/posts/${post.hash}`),
      { params: Promise.resolve({ hash: post.hash }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.post).toMatchObject({
      id: post.id,
      hash: post.hash,
      extension: '.webp',
      mimeType: 'image/webp',
      width: 1200,
      height: 1600,
      fileSize: 456789,
      rating: 'SAFE',
      blurhash: 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH',
      sourceUrls: ['https://example.test/source'],
      urls: {
        thumbnailGrid: `/api/thumbnails/${post.hash}.webp`,
        thumbnailPreview: `/api/thumbnails/${post.hash}.webp?size=preview`,
        file: `/api/files/${post.hash}.webp`,
        download: `/api/download/${post.hash}.webp`,
      },
      navigation: {
        previousHash: previous.hash,
        nextHash: next.hash,
        currentPosition: 2,
        totalCount: 3,
      },
    });
    expect(data.post.tags).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'alice', category: 'ARTIST', count: 1 }),
      expect.objectContaining({ name: 'blue eyes', category: 'GENERAL', count: 1 }),
    ]));
    expect(data.post.notes).toEqual([
      expect.objectContaining({
        name: 'caption',
        content: 'hello world',
        translation: expect.objectContaining({
          translatedContent: 'hallo welt',
          sourceLanguage: 'en',
          targetLanguage: 'de',
        }),
      }),
    ]);
    expect(data.post.groups).toEqual([
      expect.objectContaining({
        id: group.id,
        sourceType: 'PIXIV',
        sourceId: '12345',
        title: 'Pixiv set',
        currentPosition: 1,
        posts: [
          expect.objectContaining({ hash: previous.hash }),
          expect.objectContaining({ hash: post.hash }),
          expect.objectContaining({ hash: next.hash }),
        ],
      }),
    ]);
  });

  it('returns 400 for malformed hashes', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/posts/not-a-hash'),
      { params: Promise.resolve({ hash: 'not-a-hash' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid hash format');
  });

  it('returns 404 when the post does not exist', async () => {
    const missingHash = 'a'.repeat(64);
    const response = await GET(
      new NextRequest(`http://localhost/api/posts/${missingHash}`),
      { params: Promise.resolve({ hash: missingHash }) }
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Post not found');
  });

  it('reports favorited state', async () => {
    const prisma = getTestPrisma();
    const post = await createPost(prisma);
    await prisma.favorite.create({ data: { postId: post.id } });

    const request = new NextRequest(`http://localhost/api/posts/${post.hash}`);
    const data = await (await GET(request, { params: Promise.resolve({ hash: post.hash }) })).json();

    expect(data.favorited).toBe(true);
  });
});
