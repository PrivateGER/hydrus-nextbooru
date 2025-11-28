import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HydrusClient, HydrusApiError, getHydrusClient } from './client';

// =============================================================================
// Mock Setup
// =============================================================================

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

/**
 * Create a mock successful response
 */
function mockOkResponse<T>(data: T) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  };
}

/**
 * Create a mock error response
 */
function mockErrorResponse(status: number, statusText: string, body: string = '') {
  return {
    ok: false,
    status,
    statusText,
    text: () => Promise.resolve(body),
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('HydrusClient', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HYDRUS_API_URL = 'http://localhost:45869';
    process.env.HYDRUS_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ===========================================================================
  // Constructor
  // ===========================================================================

  describe('constructor', () => {
    it('should throw if no API key is provided', () => {
      delete process.env.HYDRUS_API_KEY;

      expect(() => new HydrusClient({ apiUrl: 'http://test', apiKey: '' }))
        .toThrow('Hydrus API key is required');
    });

    it('should throw if API key env var is missing and no config', () => {
      delete process.env.HYDRUS_API_KEY;

      expect(() => new HydrusClient())
        .toThrow('Hydrus API key is required');
    });

    it('should use provided config over env vars', () => {
      mockFetch.mockResolvedValue(mockOkResponse({ basic_permissions: [] }));

      const client = new HydrusClient({
        apiUrl: 'http://custom:9999',
        apiKey: 'custom-key',
      });

      client.verifyAccessKey();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('http://custom:9999'),
        expect.objectContaining({
          headers: { 'Hydrus-Client-API-Access-Key': 'custom-key' },
        })
      );
    });

    it('should use env vars when no config provided', () => {
      process.env.HYDRUS_API_URL = 'http://env-url:1234';
      process.env.HYDRUS_API_KEY = 'env-key';

      mockFetch.mockResolvedValue(mockOkResponse({ basic_permissions: [] }));

      const client = new HydrusClient();
      client.verifyAccessKey();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('http://env-url:1234'),
        expect.objectContaining({
          headers: { 'Hydrus-Client-API-Access-Key': 'env-key' },
        })
      );
    });

    it('should default to localhost:45869 when no URL provided', () => {
      delete process.env.HYDRUS_API_URL;
      process.env.HYDRUS_API_KEY = 'test-key';

      mockFetch.mockResolvedValue(mockOkResponse({ basic_permissions: [] }));

      const client = new HydrusClient();
      client.verifyAccessKey();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:45869'),
        expect.any(Object)
      );
    });
  });

  // ===========================================================================
  // Request Building
  // ===========================================================================

  describe('request building', () => {
    it('should set Hydrus-Client-API-Access-Key header', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ basic_permissions: [] }));

      const client = new HydrusClient({ apiUrl: 'http://test', apiKey: 'my-secret-key' });
      await client.verifyAccessKey();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { 'Hydrus-Client-API-Access-Key': 'my-secret-key' },
        })
      );
    });

    it('should serialize arrays as JSON in query params', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ file_ids: [], hashes: [] }));

      const client = new HydrusClient({ apiUrl: 'http://test', apiKey: 'key' });
      await client.searchFiles({ tags: ['tag1', 'tag2'] });

      const calledUrl = mockFetch.mock.calls[0][0];
      // Tags should be JSON encoded: ["tag1","tag2"]
      expect(calledUrl).toContain('tags=');
      const url = new URL(calledUrl);
      const tags = url.searchParams.get('tags');
      expect(JSON.parse(tags!)).toEqual(['tag1', 'tag2']);
    });

    it('should serialize objects as JSON in query params', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ metadata: [] }));

      const client = new HydrusClient({ apiUrl: 'http://test', apiKey: 'key' });
      await client.getFileMetadata({ fileIds: [1, 2, 3] });

      const calledUrl = mockFetch.mock.calls[0][0];
      const url = new URL(calledUrl);
      const fileIds = url.searchParams.get('file_ids');
      expect(JSON.parse(fileIds!)).toEqual([1, 2, 3]);
    });

    it('should convert primitives to strings in query params', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ file_ids: [], hashes: [] }));

      const client = new HydrusClient({ apiUrl: 'http://test', apiKey: 'key' });
      await client.searchFiles({
        tags: ['test'],
        fileSortType: 2,
        fileSortAsc: true,
      });

      const calledUrl = mockFetch.mock.calls[0][0];
      const url = new URL(calledUrl);

      expect(url.searchParams.get('file_sort_type')).toBe('2');
      expect(url.searchParams.get('file_sort_asc')).toBe('true');
    });

    it('should skip undefined and null params', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ file_ids: [], hashes: [] }));

      const client = new HydrusClient({ apiUrl: 'http://test', apiKey: 'key' });
      await client.searchFiles({
        tags: ['test'],
        fileServiceKey: undefined,
        tagServiceKey: undefined,
      });

      const calledUrl = mockFetch.mock.calls[0][0];
      const url = new URL(calledUrl);

      expect(url.searchParams.has('file_service_key')).toBe(false);
      expect(url.searchParams.has('tag_service_key')).toBe(false);
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('error handling', () => {
    it('should throw HydrusApiError on non-ok response', async () => {
      mockFetch.mockResolvedValue(mockErrorResponse(403, 'Forbidden', 'Access denied'));

      const client = new HydrusClient({ apiUrl: 'http://test', apiKey: 'key' });

      await expect(client.verifyAccessKey()).rejects.toThrow(HydrusApiError);
    });

    it('should include status code in HydrusApiError', async () => {
      mockFetch.mockResolvedValue(mockErrorResponse(404, 'Not Found', 'Resource not found'));

      const client = new HydrusClient({ apiUrl: 'http://test', apiKey: 'key' });

      try {
        await client.verifyAccessKey();
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(HydrusApiError);
        expect((e as HydrusApiError).statusCode).toBe(404);
      }
    });

    it('should include response body in HydrusApiError', async () => {
      mockFetch.mockResolvedValue(mockErrorResponse(500, 'Internal Server Error', 'Detailed error message'));

      const client = new HydrusClient({ apiUrl: 'http://test', apiKey: 'key' });

      try {
        await client.verifyAccessKey();
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(HydrusApiError);
        expect((e as HydrusApiError).responseBody).toBe('Detailed error message');
      }
    });

    it('should include status text in error message', async () => {
      mockFetch.mockResolvedValue(mockErrorResponse(401, 'Unauthorized'));

      const client = new HydrusClient({ apiUrl: 'http://test', apiKey: 'key' });

      try {
        await client.verifyAccessKey();
        expect.fail('Should have thrown');
      } catch (e) {
        expect((e as HydrusApiError).message).toContain('401');
        expect((e as HydrusApiError).message).toContain('Unauthorized');
      }
    });
  });

  // ===========================================================================
  // searchFiles - Default Values
  // ===========================================================================

  describe('searchFiles defaults', () => {
    it('should always set return_file_ids to true', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ file_ids: [], hashes: [] }));

      const client = new HydrusClient({ apiUrl: 'http://test', apiKey: 'key' });
      await client.searchFiles({ tags: ['test'] });

      const calledUrl = mockFetch.mock.calls[0][0];
      const url = new URL(calledUrl);
      expect(url.searchParams.get('return_file_ids')).toBe('true');
    });

    it('should default return_hashes to true', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ file_ids: [], hashes: [] }));

      const client = new HydrusClient({ apiUrl: 'http://test', apiKey: 'key' });
      await client.searchFiles({ tags: ['test'] });

      const calledUrl = mockFetch.mock.calls[0][0];
      const url = new URL(calledUrl);
      expect(url.searchParams.get('return_hashes')).toBe('true');
    });

    it('should allow overriding return_hashes', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ file_ids: [], hashes: [] }));

      const client = new HydrusClient({ apiUrl: 'http://test', apiKey: 'key' });
      await client.searchFiles({ tags: ['test'], returnHashes: false });

      const calledUrl = mockFetch.mock.calls[0][0];
      const url = new URL(calledUrl);
      expect(url.searchParams.get('return_hashes')).toBe('false');
    });
  });

  // ===========================================================================
  // Validation - Parameterized tests for "neither X nor Y provided" errors
  // ===========================================================================

  describe('parameter validation', () => {
    it.each([
      { method: 'getFileMetadata', args: {}, error: 'Either fileIds or hashes must be provided' },
      { method: 'getFilePath', args: {}, error: 'Either fileId or hash must be provided' },
      { method: 'getThumbnailPath', args: {}, error: 'Either fileId or hash must be provided' },
      { method: 'getFile', args: {}, error: 'Either fileId or hash must be provided' },
      { method: 'getThumbnail', args: {}, error: 'Either fileId or hash must be provided' },
    ])('$method should throw when required params missing', async ({ method, args, error }) => {
      const client = new HydrusClient({ apiUrl: 'http://test', apiKey: 'key' });

      await expect((client as never)[method](args)).rejects.toThrow(error);
    });
  });

  // ===========================================================================
  // getFileMetadata - Default Values
  // ===========================================================================

  describe('getFileMetadata defaults', () => {
    it('should default include_notes to false', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ metadata: [] }));

      const client = new HydrusClient({ apiUrl: 'http://test', apiKey: 'key' });
      await client.getFileMetadata({ fileIds: [1] });

      const calledUrl = mockFetch.mock.calls[0][0];
      const url = new URL(calledUrl);
      expect(url.searchParams.get('include_notes')).toBe('false');
    });

    it('should default include_blurhash to true', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ metadata: [] }));

      const client = new HydrusClient({ apiUrl: 'http://test', apiKey: 'key' });
      await client.getFileMetadata({ fileIds: [1] });

      const calledUrl = mockFetch.mock.calls[0][0];
      const url = new URL(calledUrl);
      expect(url.searchParams.get('include_blurhash')).toBe('true');
    });

    it('should allow overriding include options', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ metadata: [] }));

      const client = new HydrusClient({ apiUrl: 'http://test', apiKey: 'key' });
      await client.getFileMetadata({
        fileIds: [1],
        includeNotes: true,
        includeBlurhash: false,
        onlyReturnBasicInfo: true,
      });

      const calledUrl = mockFetch.mock.calls[0][0];
      const url = new URL(calledUrl);
      expect(url.searchParams.get('include_notes')).toBe('true');
      expect(url.searchParams.get('include_blurhash')).toBe('false');
      expect(url.searchParams.get('only_return_basic_information')).toBe('true');
    });
  });

  // ===========================================================================
  // getThumbnailPath - Default Values
  // ===========================================================================

  describe('getThumbnailPath defaults', () => {
    it('should default include_thumbnail_filetype to true', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ path: '/path/to/thumb.jpg' }));

      const client = new HydrusClient({ apiUrl: 'http://test', apiKey: 'key' });
      await client.getThumbnailPath({ fileId: 123 });

      const calledUrl = mockFetch.mock.calls[0][0];
      const url = new URL(calledUrl);
      expect(url.searchParams.get('include_thumbnail_filetype')).toBe('true');
    });

    it('should allow overriding includeFiletype', async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ path: '/path/to/thumb' }));

      const client = new HydrusClient({ apiUrl: 'http://test', apiKey: 'key' });
      await client.getThumbnailPath({ fileId: 123, includeFiletype: false });

      const calledUrl = mockFetch.mock.calls[0][0];
      const url = new URL(calledUrl);
      expect(url.searchParams.get('include_thumbnail_filetype')).toBe('false');
    });
  });

  // ===========================================================================
  // getFile - Precedence Logic
  // ===========================================================================

  describe('getFile', () => {
    it('should prefer fileId over hash when both provided', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const client = new HydrusClient({ apiUrl: 'http://test', apiKey: 'key' });
      await client.getFile({ fileId: 123, hash: 'abc' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test/get_files/file?file_id=123',
        expect.any(Object)
      );
    });
  });
});

// =============================================================================
// HydrusApiError
// =============================================================================

describe('HydrusApiError', () => {
  it('should have correct name', () => {
    const error = new HydrusApiError('Test error', 500);
    expect(error.name).toBe('HydrusApiError');
  });

  it('should store statusCode', () => {
    const error = new HydrusApiError('Test error', 403);
    expect(error.statusCode).toBe(403);
  });

  it('should store responseBody when provided', () => {
    const error = new HydrusApiError('Test error', 400, 'Bad request body');
    expect(error.responseBody).toBe('Bad request body');
  });

  it('should have undefined responseBody when not provided', () => {
    const error = new HydrusApiError('Test error', 500);
    expect(error.responseBody).toBeUndefined();
  });

  it('should extend Error', () => {
    const error = new HydrusApiError('Test error', 500);
    expect(error).toBeInstanceOf(Error);
  });

  it('should have correct message', () => {
    const error = new HydrusApiError('Custom error message', 404);
    expect(error.message).toBe('Custom error message');
  });
});

// =============================================================================
// getHydrusClient (singleton)
// =============================================================================

describe('getHydrusClient', () => {
  beforeEach(() => {
    process.env.HYDRUS_API_URL = 'http://localhost:45869';
    process.env.HYDRUS_API_KEY = 'test-api-key';
  });

  it('should return a HydrusClient instance', () => {
    const client = getHydrusClient();
    expect(client).toBeInstanceOf(HydrusClient);
  });

  it('should return the same instance on subsequent calls', () => {
    const client1 = getHydrusClient();
    const client2 = getHydrusClient();
    expect(client1).toBe(client2);
  });
});
