import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from '../setup';
import { setTestPrisma } from '@/lib/db';
import { createPost, createPostWithTags, createGroup, createPostInGroup, randomHash } from '../factories';
import { setupTestFiles, createTestFile, cleanupTestFiles, createPngBuffer, createJpegBuffer } from '../file-helpers';
import { TagCategory, SourceType } from '@/generated/prisma/client';

let GET: typeof import('@/app/api/download/[filename]/route').GET;

describe('GET /api/download/[filename] (Integration)', () => {
  beforeAll(async () => {
    await setupTestFiles();
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);
    const module = await import('@/app/api/download/[filename]/route');
    GET = module.GET;
  });

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
    await cleanupTestFiles();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('validation', () => {
    it('should return 400 for invalid filename format', async () => {
      const request = new NextRequest('http://localhost/api/download/invalid.png');
      const response = await GET(request, { params: Promise.resolve({ filename: 'invalid.png' }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid filename');
    });

    it('should return 400 for filename without extension', async () => {
      const hash = randomHash();
      const request = new NextRequest(`http://localhost/api/download/${hash}`);
      const response = await GET(request, { params: Promise.resolve({ filename: hash }) });

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent post', async () => {
      const hash = randomHash();
      const request = new NextRequest(`http://localhost/api/download/${hash}.png`);
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.png` }) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('File not found');
    });

    it('should return 400 for extension mismatch', async () => {
      const prisma = getTestPrisma();
      const hash = randomHash();
      await createPost(prisma, { hash, extension: '.png' });
      await createTestFile(hash, '.png', createPngBuffer());

      const request = new NextRequest(`http://localhost/api/download/${hash}.jpg`);
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.jpg` }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Extension mismatch');
    });
  });

  describe('file serving', () => {
    it('should serve file with Content-Disposition header', async () => {
      const prisma = getTestPrisma();
      const hash = randomHash();
      const content = createPngBuffer();
      await createPost(prisma, { hash, extension: '.png', mimeType: 'image/png', fileSize: content.length });
      await createTestFile(hash, '.png', content);

      const request = new NextRequest(`http://localhost/api/download/${hash}.png`);
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.png` }) });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('image/png');
      expect(response.headers.get('Content-Disposition')).toContain('attachment');
      expect(response.headers.get('Content-Length')).toBe(String(content.length));
    });

    it('should return 404 when file not on disk', async () => {
      const prisma = getTestPrisma();
      const hash = randomHash();
      await createPost(prisma, { hash, extension: '.png' });
      // Don't create the actual file

      const request = new NextRequest(`http://localhost/api/download/${hash}.png`);
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.png` }) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('File not found on disk');
    });

    it('should set cache headers', async () => {
      const prisma = getTestPrisma();
      const hash = randomHash();
      await createPost(prisma, { hash, extension: '.png' });
      await createTestFile(hash, '.png', createPngBuffer());

      const request = new NextRequest(`http://localhost/api/download/${hash}.png`);
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.png` }) });

      expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    });
  });

  describe('download filename generation', () => {
    it('should include artist tag in filename', async () => {
      const prisma = getTestPrisma();
      const hash = randomHash();
      await createPostWithTags(prisma, [{ name: 'john_doe', category: TagCategory.ARTIST }], {
        hash,
        extension: '.png',
      });
      await createTestFile(hash, '.png', createPngBuffer());

      const request = new NextRequest(`http://localhost/api/download/${hash}.png`);
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.png` }) });

      const disposition = response.headers.get('Content-Disposition')!;
      expect(disposition).toContain('john_doe');
    });

    it('should include character tag in filename', async () => {
      const prisma = getTestPrisma();
      const hash = randomHash();
      await createPostWithTags(prisma, [{ name: 'sakura', category: TagCategory.CHARACTER }], {
        hash,
        extension: '.png',
      });
      await createTestFile(hash, '.png', createPngBuffer());

      const request = new NextRequest(`http://localhost/api/download/${hash}.png`);
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.png` }) });

      const disposition = response.headers.get('Content-Disposition')!;
      expect(disposition).toContain('sakura');
    });

    it('should include both artist and character in filename', async () => {
      const prisma = getTestPrisma();
      const hash = randomHash();
      await createPostWithTags(
        prisma,
        [
          { name: 'artist_name', category: TagCategory.ARTIST },
          { name: 'character_name', category: TagCategory.CHARACTER },
        ],
        { hash, extension: '.png' }
      );
      await createTestFile(hash, '.png', createPngBuffer());

      const request = new NextRequest(`http://localhost/api/download/${hash}.png`);
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.png` }) });

      const disposition = response.headers.get('Content-Disposition')!;
      expect(disposition).toContain('artist_name');
      expect(disposition).toContain('character_name');
    });

    it('should include page number for posts in groups', async () => {
      const prisma = getTestPrisma();
      const hash = randomHash();
      const group = await createGroup(prisma, SourceType.PIXIV, '12345');
      // Create multiple posts in the group so _count.posts > 1
      await createPostInGroup(prisma, group, 1, { extension: '.png' });
      await createPostInGroup(prisma, group, 2, { extension: '.png' });
      await createPostInGroup(prisma, group, 3, { hash, extension: '.png' });
      await createTestFile(hash, '.png', createPngBuffer());

      const request = new NextRequest(`http://localhost/api/download/${hash}.png`);
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.png` }) });

      const disposition = response.headers.get('Content-Disposition')!;
      expect(disposition).toContain('p3');
    });

    it('should always include shortened hash in filename', async () => {
      const prisma = getTestPrisma();
      const hash = randomHash();
      await createPost(prisma, { hash, extension: '.png' });
      await createTestFile(hash, '.png', createPngBuffer());

      const request = new NextRequest(`http://localhost/api/download/${hash}.png`);
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.png` }) });

      const disposition = response.headers.get('Content-Disposition')!;
      expect(disposition).toContain(hash.slice(0, 8));
    });

    it('should sanitize special characters in tags for filename', async () => {
      const prisma = getTestPrisma();
      const hash = randomHash();
      await createPostWithTags(prisma, [{ name: 'artist:with/special<chars', category: TagCategory.ARTIST }], {
        hash,
        extension: '.png',
      });
      await createTestFile(hash, '.png', createPngBuffer());

      const request = new NextRequest(`http://localhost/api/download/${hash}.png`);
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.png` }) });

      const disposition = response.headers.get('Content-Disposition')!;
      // Extract the filename from the header (format: attachment; filename="name.ext")
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      expect(filenameMatch).not.toBeNull();
      const filename = filenameMatch![1];
      // Should not contain invalid filename characters
      expect(filename).not.toMatch(/[<>:"/\\|?*]/);
    });

    it('should prefer non-numeric artist tags', async () => {
      const prisma = getTestPrisma();
      const hash = randomHash();

      // Create post
      const post = await createPost(prisma, { hash, extension: '.png' });

      // Create tags - numeric first, then named
      const numericTag = await prisma.tag.create({
        data: { name: '12345678', category: TagCategory.ARTIST, postCount: 1 },
      });
      const namedTag = await prisma.tag.create({
        data: { name: 'real_artist', category: TagCategory.ARTIST, postCount: 1 },
      });

      await prisma.postTag.createMany({
        data: [
          { postId: post.id, tagId: numericTag.id },
          { postId: post.id, tagId: namedTag.id },
        ],
      });

      await createTestFile(hash, '.png', createPngBuffer());

      const request = new NextRequest(`http://localhost/api/download/${hash}.png`);
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.png` }) });

      const disposition = response.headers.get('Content-Disposition')!;
      expect(disposition).toContain('real_artist');
    });

    it('should not include page number for single-post groups', async () => {
      const prisma = getTestPrisma();
      const hash = randomHash();
      const group = await createGroup(prisma, SourceType.PIXIV, '12345');
      // Only one post in the group
      await createPostInGroup(prisma, group, 0, { hash, extension: '.png' });
      await createTestFile(hash, '.png', createPngBuffer());

      const request = new NextRequest(`http://localhost/api/download/${hash}.png`);
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.png` }) });

      const disposition = response.headers.get('Content-Disposition')!;
      // Should not have page number for single-post group
      expect(disposition).not.toMatch(/p\d+/);
    });
  });
});
