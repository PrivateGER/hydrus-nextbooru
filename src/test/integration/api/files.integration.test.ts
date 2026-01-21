import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  setupFsMock,
  teardownFsMock,
  resetFsVolume,
  createMemfsFile,
  createPngBuffer,
} from '../file-helpers';
import { randomHash } from '../factories';

let GET: typeof import('@/app/api/files/[filename]/route').GET;

describe('GET /api/files/[filename] (Integration)', () => {
  beforeAll(async () => {
    process.env.HYDRUS_FILES_PATH = '/hydrus/files';
    await setupFsMock();
    const module = await import('@/app/api/files/[filename]/route');
    GET = module.GET;
  });

  afterAll(() => {
    teardownFsMock();
  });

  beforeEach(() => {
    resetFsVolume();
  });

  /**
   * Helper to create a test file in the memfs virtual filesystem.
   * Path: {HYDRUS_FILES_PATH}/f{hash[0:2]}/{hash}{extension}
   */
  function createTestFile(hash: string, extension: string, content: Buffer = Buffer.from('test content')): void {
    const prefix = hash.substring(0, 2).toLowerCase();
    createMemfsFile(`/hydrus/files/f${prefix}/${hash}${extension}`, content);
  }

  describe('file serving', () => {
    it('should serve an existing file with correct content', async () => {
      const hash = randomHash();
      const content = createPngBuffer();
      createTestFile(hash, '.png', content);

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
      createTestFile(hash, '.png', createPngBuffer());

      const request = new NextRequest(`http://localhost/api/files/${hash}.png`);
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.png` }) });

      expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
      expect(response.headers.get('ETag')).toBe(`"${hash}"`);
    });

    it('should return 304 for matching ETag', async () => {
      const hash = randomHash();
      createTestFile(hash, '.png', createPngBuffer());

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
      createTestFile(hash, '.mp4', content);

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
      createTestFile(hash, '.mp4', Buffer.alloc(100));

      const request = new NextRequest(`http://localhost/api/files/${hash}.mp4`);
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.mp4` }) });

      expect(response.headers.get('Accept-Ranges')).toBe('bytes');
    });

    it('should handle suffix range request (bytes=-N)', async () => {
      const hash = randomHash();
      // Create content where we can verify the last 100 bytes
      const content = Buffer.alloc(1000);
      content.fill('a', 0, 900);
      content.fill('b', 900, 1000); // Last 100 bytes are 'b'
      createTestFile(hash, '.mp4', content);

      const request = new NextRequest(`http://localhost/api/files/${hash}.mp4`, {
        headers: { Range: 'bytes=-100' },
      });
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.mp4` }) });

      expect(response.status).toBe(206);
      expect(response.headers.get('Content-Range')).toBe('bytes 900-999/1000');
      expect(response.headers.get('Content-Length')).toBe('100');

      const responseBuffer = Buffer.from(await response.arrayBuffer());
      expect(responseBuffer).toEqual(content.subarray(900, 1000));
    });

    it('should handle suffix range larger than file size', async () => {
      const hash = randomHash();
      const content = Buffer.from('small file');
      createTestFile(hash, '.mp4', content);

      const request = new NextRequest(`http://localhost/api/files/${hash}.mp4`, {
        headers: { Range: 'bytes=-1000' }, // Request more than file size
      });
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.mp4` }) });

      expect(response.status).toBe(206);
      // Should return entire file when suffix exceeds file size
      expect(response.headers.get('Content-Range')).toBe(`bytes 0-${content.length - 1}/${content.length}`);
      expect(response.headers.get('Content-Length')).toBe(String(content.length));

      const responseBuffer = Buffer.from(await response.arrayBuffer());
      expect(responseBuffer).toEqual(content);
    });

    it('should return 416 for invalid suffix range (zero)', async () => {
      const hash = randomHash();
      createTestFile(hash, '.mp4', Buffer.alloc(100));

      const request = new NextRequest(`http://localhost/api/files/${hash}.mp4`, {
        headers: { Range: 'bytes=-0' },
      });
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.mp4` }) });

      expect(response.status).toBe(416);
      expect(response.headers.get('Content-Range')).toBe('bytes */100');
    });

    it('should return 416 for invalid suffix range (negative)', async () => {
      const hash = randomHash();
      createTestFile(hash, '.mp4', Buffer.alloc(100));

      const request = new NextRequest(`http://localhost/api/files/${hash}.mp4`, {
        headers: { Range: 'bytes=--50' },
      });
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.mp4` }) });

      expect(response.status).toBe(416);
    });

    it('should clamp end to file size when range exceeds bounds', async () => {
      const hash = randomHash();
      const content = Buffer.alloc(100, 'x');
      createTestFile(hash, '.mp4', content);

      const request = new NextRequest(`http://localhost/api/files/${hash}.mp4`, {
        headers: { Range: 'bytes=50-999' }, // End exceeds file size
      });
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.mp4` }) });

      expect(response.status).toBe(206);
      expect(response.headers.get('Content-Range')).toBe('bytes 50-99/100');
      expect(response.headers.get('Content-Length')).toBe('50');

      const responseBuffer = Buffer.from(await response.arrayBuffer());
      expect(responseBuffer).toEqual(content.subarray(50, 100));
    });

    it('should handle open-ended range (bytes=N-)', async () => {
      const hash = randomHash();
      const content = Buffer.alloc(100, 'x');
      createTestFile(hash, '.mp4', content);

      const request = new NextRequest(`http://localhost/api/files/${hash}.mp4`, {
        headers: { Range: 'bytes=80-' },
      });
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.mp4` }) });

      expect(response.status).toBe(206);
      expect(response.headers.get('Content-Range')).toBe('bytes 80-99/100');
      expect(response.headers.get('Content-Length')).toBe('20');
    });

    it('should return 416 for start beyond file size', async () => {
      const hash = randomHash();
      createTestFile(hash, '.mp4', Buffer.alloc(100));

      const request = new NextRequest(`http://localhost/api/files/${hash}.mp4`, {
        headers: { Range: 'bytes=200-300' },
      });
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.mp4` }) });

      expect(response.status).toBe(416);
      expect(response.headers.get('Content-Range')).toBe('bytes */100');
    });

    it('should return 416 when start > end', async () => {
      const hash = randomHash();
      createTestFile(hash, '.mp4', Buffer.alloc(100));

      const request = new NextRequest(`http://localhost/api/files/${hash}.mp4`, {
        headers: { Range: 'bytes=50-20' },
      });
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}.mp4` }) });

      expect(response.status).toBe(416);
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
      createTestFile(hash, ext, Buffer.from('test'));

      const request = new NextRequest(`http://localhost/api/files/${hash}${ext}`);
      const response = await GET(request, { params: Promise.resolve({ filename: `${hash}${ext}` }) });

      expect(response.headers.get('Content-Type')).toBe(expectedMime);
    });
  });
});
