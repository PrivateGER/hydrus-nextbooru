import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestFiles, createTestFile, cleanupTestFiles, createPngBuffer } from '../file-helpers';
import { randomHash } from '../factories';

let GET: typeof import('@/app/api/files/[filename]/route').GET;

describe('GET /api/files/[filename] (Integration)', () => {
  beforeAll(async () => {
    await setupTestFiles();
    const module = await import('@/app/api/files/[filename]/route');
    GET = module.GET;
  });

  afterAll(async () => {
    await cleanupTestFiles();
  });

  describe('file serving', () => {
    it('should serve an existing file with correct content', async () => {
      const hash = randomHash();
      const content = createPngBuffer();
      await createTestFile(hash, '.png', content);

      const request = new NextRequest(`http://localhost/api/files/${hash}.png`);
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.png` }) });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('image/png');
      expect(response.headers.get('Content-Length')).toBe(String(content.length));

      // Verify actual file content is returned correctly
      const responseBuffer = Buffer.from(await response.arrayBuffer());
      expect(responseBuffer).toEqual(content);
    });

    it('should return 404 for non-existent file', async () => {
      const hash = randomHash();
      const request = new NextRequest(`http://localhost/api/files/${hash}.png`);
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.png` }) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('File not found');
    });

    it('should return 400 for invalid filename format', async () => {
      const request = new NextRequest('http://localhost/api/files/invalid.png');
      const response = await GET(request, { params: Promise.resolve({ filename: 'invalid.png' }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid filename');
    });

    it('should return 400 for unsupported extension', async () => {
      const hash = randomHash();
      const request = new NextRequest(`http://localhost/api/files/${hash}.xyz`);
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.xyz` }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Unsupported file extension');
    });
  });

  describe('caching headers', () => {
    it('should set immutable cache headers', async () => {
      const hash = randomHash();
      await createTestFile(hash, '.png', createPngBuffer());

      const request = new NextRequest(`http://localhost/api/files/${hash}.png`);
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.png` }) });

      expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
      expect(response.headers.get('ETag')).toBe(`"${hash}"`);
    });

    it('should return 304 for matching ETag', async () => {
      const hash = randomHash();
      await createTestFile(hash, '.png', createPngBuffer());

      const request = new NextRequest(`http://localhost/api/files/${hash}.png`, {
        headers: { 'If-None-Match': `"${hash}"` },
      });
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.png` }) });

      expect(response.status).toBe(304);
    });
  });

  describe('range requests', () => {
    it('should handle range request for partial content', async () => {
      const hash = randomHash();
      const content = Buffer.alloc(1000, 'x');
      await createTestFile(hash, '.mp4', content);

      const request = new NextRequest(`http://localhost/api/files/${hash}.mp4`, {
        headers: { Range: 'bytes=0-99' },
      });
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.mp4` }) });

      expect(response.status).toBe(206);
      expect(response.headers.get('Content-Range')).toBe('bytes 0-99/1000');
      expect(response.headers.get('Content-Length')).toBe('100');

      // Verify the correct byte range is returned
      const responseBuffer = Buffer.from(await response.arrayBuffer());
      expect(responseBuffer).toEqual(content.subarray(0, 100));
    });

    it('should set Accept-Ranges header', async () => {
      const hash = randomHash();
      await createTestFile(hash, '.mp4', Buffer.alloc(100));

      const request = new NextRequest(`http://localhost/api/files/${hash}.mp4`);
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.mp4` }) });

      expect(response.headers.get('Accept-Ranges')).toBe('bytes');
    });
  });

  describe('MIME types', () => {
    it.each([
      ['.jpg', 'image/jpeg'],
      ['.jpeg', 'image/jpeg'],
      ['.png', 'image/png'],
      ['.gif', 'image/gif'],
      ['.webp', 'image/webp'],
      ['.mp4', 'video/mp4'],
      ['.webm', 'video/webm'],
    ])('should serve %s with correct MIME type', async (ext, expectedMime) => {
      const hash = randomHash();
      await createTestFile(hash, ext, Buffer.from('test'));

      const request = new NextRequest(`http://localhost/api/files/${hash}${ext}`);
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}${ext}` }) });

      expect(response.headers.get('Content-Type')).toBe(expectedMime);
    });
  });
});
