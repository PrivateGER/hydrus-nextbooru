import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { createPost, randomHash } from '../factories';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { ThumbnailSize, ThumbnailStatus } from '@/generated/prisma/client';

let GET: typeof import('@/app/api/thumbnails/[filename]/route').GET;

// Test thumbnail directory
const TEST_THUMBNAIL_PATH = join(process.cwd(), 'test-thumbnails');

describe('GET /api/thumbnails/[filename] (Integration)', () => {
  beforeAll(async () => {
    // Set up test thumbnail directory
    process.env.THUMBNAIL_PATH = TEST_THUMBNAIL_PATH;
    await mkdir(TEST_THUMBNAIL_PATH, { recursive: true });

    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);
    const module = await import('@/app/api/thumbnails/[filename]/route');
    GET = module.GET;
  });

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
    // Clean up test thumbnails
    await rm(TEST_THUMBNAIL_PATH, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('validation', () => {
    it('should return 400 for invalid filename format', async () => {
      const request = new NextRequest('http://localhost/api/thumbnails/invalid.webp');
      const response = await GET(request, { params: Promise.resolve({ filename: 'invalid.webp' }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid filename');
    });

    it('should return 400 for wrong extension', async () => {
      const hash = randomHash();
      const request = new NextRequest(`http://localhost/api/thumbnails/${hash}.png`);
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.png` }) });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid size parameter', async () => {
      const hash = randomHash();
      const request = new NextRequest(`http://localhost/api/thumbnails/${hash}.webp?size=huge`);
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.webp` }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid size');
    });

    it('should return 404 for non-existent post', async () => {
      const hash = randomHash();
      const request = new NextRequest(`http://localhost/api/thumbnails/${hash}.webp`);
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.webp` }) });

      expect(response.status).toBe(404);
    });
  });

  describe('generated thumbnails', () => {
    it('should serve generated thumbnail when available', async () => {
      const prisma = getTestPrisma();
      const hash = randomHash();

      // Create post with thumbnail record
      const post = await createPost(prisma, {
        hash,
        thumbnailStatus: ThumbnailStatus.COMPLETE,
      });

      // Create thumbnail record and file
      const relativePath = `grid/${hash.substring(0, 2)}/${hash}.webp`;
      await prisma.thumbnail.create({
        data: {
          postId: post.id,
          size: ThumbnailSize.GRID,
          path: relativePath,
          width: 300,
          height: 225,
          fileSize: 5000,
          format: 'webp',
        },
      });

      // Create actual thumbnail file
      const thumbnailDir = join(TEST_THUMBNAIL_PATH, 'grid', hash.substring(0, 2));
      await mkdir(thumbnailDir, { recursive: true });
      const thumbnailContent = Buffer.from('fake webp content');
      await writeFile(join(thumbnailDir, `${hash}.webp`), thumbnailContent);

      const request = new NextRequest(`http://localhost/api/thumbnails/${hash}.webp`);
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.webp` }) });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('image/webp');
      expect(response.headers.get('X-Thumbnail-Source')).toBe('generated');
      expect(response.headers.get('Cache-Control')).toContain('immutable');

      // Verify actual content is returned
      const responseBuffer = Buffer.from(await response.arrayBuffer());
      expect(responseBuffer).toEqual(thumbnailContent);
    });

    it('should serve preview size when requested', async () => {
      const prisma = getTestPrisma();
      const hash = randomHash();

      const post = await createPost(prisma, {
        hash,
        thumbnailStatus: ThumbnailStatus.COMPLETE,
      });

      const relativePath = `preview/${hash.substring(0, 2)}/${hash}.webp`;
      await prisma.thumbnail.create({
        data: {
          postId: post.id,
          size: ThumbnailSize.PREVIEW,
          path: relativePath,
          width: 600,
          height: 450,
          fileSize: 15000,
          format: 'webp',
        },
      });

      const thumbnailDir = join(TEST_THUMBNAIL_PATH, 'preview', hash.substring(0, 2));
      await mkdir(thumbnailDir, { recursive: true });
      await writeFile(join(thumbnailDir, `${hash}.webp`), Buffer.from('fake preview content'));

      const request = new NextRequest(`http://localhost/api/thumbnails/${hash}.webp?size=preview`);
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.webp` }) });

      expect(response.status).toBe(200);
    });
  });

  describe('caching', () => {
    it('should return 304 for matching ETag on generated thumbnail', async () => {
      const prisma = getTestPrisma();
      const hash = randomHash();

      const post = await createPost(prisma, {
        hash,
        thumbnailStatus: ThumbnailStatus.COMPLETE,
      });

      const relativePath = `grid/${hash.substring(0, 2)}/${hash}.webp`;
      await prisma.thumbnail.create({
        data: {
          postId: post.id,
          size: ThumbnailSize.GRID,
          path: relativePath,
          width: 300,
          height: 225,
          fileSize: 5000,
          format: 'webp',
        },
      });

      const thumbnailDir = join(TEST_THUMBNAIL_PATH, 'grid', hash.substring(0, 2));
      await mkdir(thumbnailDir, { recursive: true });
      await writeFile(join(thumbnailDir, `${hash}.webp`), Buffer.from('content'));

      const request = new NextRequest(`http://localhost/api/thumbnails/${hash}.webp`, {
        headers: { 'If-None-Match': `"${hash}-generated"` },
      });
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.webp` }) });

      expect(response.status).toBe(304);
    });
  });
});
