import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { prismaMock, resetPrismaMock } from '@/test/mocks/prisma';
import { Readable } from 'stream';

// =============================================================================
// Mocks
// =============================================================================

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

// Mock fs module
const mockStatSync = vi.fn();
const mockCreateReadStream = vi.fn();

vi.mock('fs', () => ({
  statSync: (...args: unknown[]) => mockStatSync(...args),
  createReadStream: (...args: unknown[]) => mockCreateReadStream(...args),
}));

// Mock buildFilePath
vi.mock('@/lib/hydrus/paths', () => ({
  buildFilePath: vi.fn((hash: string, ext: string) => `/mock/path/${hash}${ext}`),
}));

// Import after mocking
import { GET } from './route';

// =============================================================================
// Test Helpers
// =============================================================================

const VALID_HASH = 'a'.repeat(64);

/**
 * Create a mock NextRequest
 */
function createRequest(hash: string, headers: Record<string, string> = {}): NextRequest {
  const url = new URL(`http://localhost:3000/api/files/${hash}`);
  return new NextRequest(url, { headers });
}

/**
 * Create mock params object (Next.js 15+ uses Promise)
 */
function createParams(hash: string): { params: Promise<{ hash: string }> } {
  return { params: Promise.resolve({ hash }) };
}

/**
 * Create a mock readable stream
 */
function createMockStream(): Readable {
  const stream = new Readable({
    read() {
      this.push(Buffer.from('mock file content'));
      this.push(null);
    },
  });
  return stream;
}

/**
 * Create a mock post record
 */
function createMockPost(overrides: Partial<{
  extension: string;
  mimeType: string;
  fileSize: number;
}> = {}) {
  return {
    extension: '.png',
    mimeType: 'image/png',
    fileSize: 1024,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('GET /api/files/[hash]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPrismaMock();

    // Default mock implementations
    mockStatSync.mockReturnValue({ size: 1024 });
    mockCreateReadStream.mockReturnValue(createMockStream());
  });

  describe('hash validation', () => {
    it('should reject hash shorter than 64 characters', async () => {
      const shortHash = 'a'.repeat(63);
      const request = createRequest(shortHash);

      const response = await GET(request, createParams(shortHash));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid hash format');
      expect(prismaMock.post.findUnique).not.toHaveBeenCalled();
    });

    it('should reject hash longer than 64 characters', async () => {
      const longHash = 'a'.repeat(65);
      const request = createRequest(longHash);

      const response = await GET(request, createParams(longHash));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid hash format');
    });

    it('should reject hash with invalid characters', async () => {
      const invalidHash = 'g'.repeat(64); // 'g' is not valid hex
      const request = createRequest(invalidHash);

      const response = await GET(request, createParams(invalidHash));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid hash format');
    });

    it('should accept valid lowercase hash', async () => {
      const hash = 'abcdef0123456789'.repeat(4);
      prismaMock.post.findUnique.mockResolvedValue(createMockPost() as never);

      const request = createRequest(hash);
      await GET(request, createParams(hash));

      expect(prismaMock.post.findUnique).toHaveBeenCalled();
    });

    it('should accept valid uppercase hash', async () => {
      const hash = 'ABCDEF0123456789'.repeat(4);
      prismaMock.post.findUnique.mockResolvedValue(createMockPost() as never);

      const request = createRequest(hash);
      await GET(request, createParams(hash));

      expect(prismaMock.post.findUnique).toHaveBeenCalled();
    });

    it('should accept mixed case hash', async () => {
      const hash = 'AbCdEf0123456789'.repeat(4);
      prismaMock.post.findUnique.mockResolvedValue(createMockPost() as never);

      const request = createRequest(hash);
      await GET(request, createParams(hash));

      expect(prismaMock.post.findUnique).toHaveBeenCalled();
    });
  });

  describe('database lookup', () => {
    it('should return 404 when post not found in database', async () => {
      prismaMock.post.findUnique.mockResolvedValue(null);

      const request = createRequest(VALID_HASH);
      const response = await GET(request, createParams(VALID_HASH));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('File not found');
    });

    it('should query database with lowercase hash', async () => {
      const upperHash = 'ABCDEF'.padEnd(64, '0');
      prismaMock.post.findUnique.mockResolvedValue(createMockPost() as never);

      const request = createRequest(upperHash);
      await GET(request, createParams(upperHash));

      expect(prismaMock.post.findUnique).toHaveBeenCalledWith({
        where: { hash: upperHash.toLowerCase() },
        select: {
          extension: true,
          mimeType: true,
          fileSize: true,
        },
      });
    });
  });

  describe('full file response', () => {
    it('should return 200 with file content', async () => {
      prismaMock.post.findUnique.mockResolvedValue(createMockPost() as never);

      const request = createRequest(VALID_HASH);
      const response = await GET(request, createParams(VALID_HASH));

      expect(response.status).toBe(200);
    });

    it('should set correct Content-Type header', async () => {
      prismaMock.post.findUnique.mockResolvedValue(
        createMockPost({ mimeType: 'video/mp4' }) as never
      );

      const request = createRequest(VALID_HASH);
      const response = await GET(request, createParams(VALID_HASH));

      expect(response.headers.get('Content-Type')).toBe('video/mp4');
    });

    it('should set Content-Length from file stats', async () => {
      prismaMock.post.findUnique.mockResolvedValue(createMockPost() as never);
      mockStatSync.mockReturnValue({ size: 5000 });

      const request = createRequest(VALID_HASH);
      const response = await GET(request, createParams(VALID_HASH));

      expect(response.headers.get('Content-Length')).toBe('5000');
    });

    it('should set Accept-Ranges header', async () => {
      prismaMock.post.findUnique.mockResolvedValue(createMockPost() as never);

      const request = createRequest(VALID_HASH);
      const response = await GET(request, createParams(VALID_HASH));

      expect(response.headers.get('Accept-Ranges')).toBe('bytes');
    });

    it('should set Cache-Control for immutable caching', async () => {
      prismaMock.post.findUnique.mockResolvedValue(createMockPost() as never);

      const request = createRequest(VALID_HASH);
      const response = await GET(request, createParams(VALID_HASH));

      expect(response.headers.get('Cache-Control')).toBe(
        'public, max-age=31536000, immutable'
      );
    });

    it('should handle different file types', async () => {
      const testCases = [
        { extension: '.png', mimeType: 'image/png' },
        { extension: '.jpg', mimeType: 'image/jpeg' },
        { extension: '.gif', mimeType: 'image/gif' },
        { extension: '.webm', mimeType: 'video/webm' },
        { extension: '.mp4', mimeType: 'video/mp4' },
      ];

      for (const { extension, mimeType } of testCases) {
        vi.clearAllMocks();
        mockStatSync.mockReturnValue({ size: 1024 });
        mockCreateReadStream.mockReturnValue(createMockStream());
        prismaMock.post.findUnique.mockResolvedValue(
          createMockPost({ extension, mimeType }) as never
        );

        const request = createRequest(VALID_HASH);
        const response = await GET(request, createParams(VALID_HASH));

        expect(response.headers.get('Content-Type')).toBe(mimeType);
      }
    });
  });

  describe('range requests', () => {
    it('should return 206 for range request', async () => {
      prismaMock.post.findUnique.mockResolvedValue(createMockPost() as never);
      mockStatSync.mockReturnValue({ size: 10000 });

      const request = createRequest(VALID_HASH, { Range: 'bytes=0-999' });
      const response = await GET(request, createParams(VALID_HASH));

      expect(response.status).toBe(206);
    });

    it('should set Content-Range header correctly', async () => {
      prismaMock.post.findUnique.mockResolvedValue(createMockPost() as never);
      mockStatSync.mockReturnValue({ size: 10000 });

      const request = createRequest(VALID_HASH, { Range: 'bytes=0-999' });
      const response = await GET(request, createParams(VALID_HASH));

      expect(response.headers.get('Content-Range')).toBe('bytes 0-999/10000');
    });

    it('should set correct Content-Length for partial content', async () => {
      prismaMock.post.findUnique.mockResolvedValue(createMockPost() as never);
      mockStatSync.mockReturnValue({ size: 10000 });

      const request = createRequest(VALID_HASH, { Range: 'bytes=0-999' });
      const response = await GET(request, createParams(VALID_HASH));

      expect(response.headers.get('Content-Length')).toBe('1000');
    });

    it('should handle range request without end', async () => {
      prismaMock.post.findUnique.mockResolvedValue(createMockPost() as never);
      mockStatSync.mockReturnValue({ size: 10000 });

      const request = createRequest(VALID_HASH, { Range: 'bytes=5000-' });
      const response = await GET(request, createParams(VALID_HASH));

      expect(response.status).toBe(206);
      expect(response.headers.get('Content-Range')).toBe('bytes 5000-9999/10000');
      expect(response.headers.get('Content-Length')).toBe('5000');
    });

    it('should create read stream with correct start/end', async () => {
      prismaMock.post.findUnique.mockResolvedValue(
        createMockPost({ extension: '.mp4' }) as never
      );
      mockStatSync.mockReturnValue({ size: 10000 });

      const request = createRequest(VALID_HASH, { Range: 'bytes=1000-2000' });
      await GET(request, createParams(VALID_HASH));

      expect(mockCreateReadStream).toHaveBeenCalledWith(
        expect.stringContaining(VALID_HASH.toLowerCase()),
        { start: 1000, end: 2000 }
      );
    });

    it('should handle range request for video seeking', async () => {
      prismaMock.post.findUnique.mockResolvedValue(
        createMockPost({ mimeType: 'video/mp4', extension: '.mp4' }) as never
      );
      mockStatSync.mockReturnValue({ size: 50000000 }); // 50MB video

      // Simulate seeking to middle of video
      const request = createRequest(VALID_HASH, { Range: 'bytes=25000000-25999999' });
      const response = await GET(request, createParams(VALID_HASH));

      expect(response.status).toBe(206);
      expect(response.headers.get('Content-Type')).toBe('video/mp4');
      expect(response.headers.get('Content-Range')).toBe('bytes 25000000-25999999/50000000');
    });

    it('should include Accept-Ranges in partial response', async () => {
      prismaMock.post.findUnique.mockResolvedValue(createMockPost() as never);
      mockStatSync.mockReturnValue({ size: 10000 });

      const request = createRequest(VALID_HASH, { Range: 'bytes=0-999' });
      const response = await GET(request, createParams(VALID_HASH));

      expect(response.headers.get('Accept-Ranges')).toBe('bytes');
    });

    it('should include Cache-Control in partial response', async () => {
      prismaMock.post.findUnique.mockResolvedValue(createMockPost() as never);
      mockStatSync.mockReturnValue({ size: 10000 });

      const request = createRequest(VALID_HASH, { Range: 'bytes=0-999' });
      const response = await GET(request, createParams(VALID_HASH));

      expect(response.headers.get('Cache-Control')).toBe(
        'public, max-age=31536000, immutable'
      );
    });
  });

  describe('file system errors', () => {
    it('should return 404 when file not found on disk (ENOENT)', async () => {
      prismaMock.post.findUnique.mockResolvedValue(createMockPost() as never);
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockStatSync.mockImplementation(() => {
        throw error;
      });

      const request = createRequest(VALID_HASH);
      const response = await GET(request, createParams(VALID_HASH));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('File not found on disk');
    });

    it('should return 500 for other file system errors', async () => {
      prismaMock.post.findUnique.mockResolvedValue(createMockPost() as never);
      const error = new Error('Permission denied') as NodeJS.ErrnoException;
      error.code = 'EACCES';
      mockStatSync.mockImplementation(() => {
        throw error;
      });

      const request = createRequest(VALID_HASH);
      const response = await GET(request, createParams(VALID_HASH));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('should return 500 for unexpected errors', async () => {
      prismaMock.post.findUnique.mockResolvedValue(createMockPost() as never);
      mockStatSync.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const request = createRequest(VALID_HASH);
      const response = await GET(request, createParams(VALID_HASH));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete video streaming workflow', async () => {
      const videoSize = 100000000; // 100MB
      prismaMock.post.findUnique.mockResolvedValue(
        createMockPost({
          extension: '.mp4',
          mimeType: 'video/mp4',
          fileSize: videoSize,
        }) as never
      );
      mockStatSync.mockReturnValue({ size: videoSize });

      // Initial request (browser checking capabilities)
      const initialRequest = createRequest(VALID_HASH);
      const initialResponse = await GET(initialRequest, createParams(VALID_HASH));

      expect(initialResponse.status).toBe(200);
      expect(initialResponse.headers.get('Accept-Ranges')).toBe('bytes');

      // Range request (video player seeking)
      vi.clearAllMocks();
      mockStatSync.mockReturnValue({ size: videoSize });
      mockCreateReadStream.mockReturnValue(createMockStream());
      prismaMock.post.findUnique.mockResolvedValue(
        createMockPost({
          extension: '.mp4',
          mimeType: 'video/mp4',
        }) as never
      );

      const rangeRequest = createRequest(VALID_HASH, { Range: 'bytes=50000000-59999999' });
      const rangeResponse = await GET(rangeRequest, createParams(VALID_HASH));

      expect(rangeResponse.status).toBe(206);
      expect(rangeResponse.headers.get('Content-Range')).toBe(
        `bytes 50000000-59999999/${videoSize}`
      );
    });

    it('should serve image with correct headers', async () => {
      prismaMock.post.findUnique.mockResolvedValue(
        createMockPost({
          extension: '.png',
          mimeType: 'image/png',
          fileSize: 50000,
        }) as never
      );
      mockStatSync.mockReturnValue({ size: 50000 });

      const request = createRequest(VALID_HASH);
      const response = await GET(request, createParams(VALID_HASH));

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('image/png');
      expect(response.headers.get('Content-Length')).toBe('50000');
      expect(response.headers.get('Cache-Control')).toContain('immutable');
    });
  });
});
