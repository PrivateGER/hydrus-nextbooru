import { describe, it, expect, afterEach } from 'vitest';
import { buildFilePath, buildThumbnailPath } from './paths';
import path from 'path';

describe('path building', () => {
  const originalEnv = process.env.HYDRUS_FILES_PATH;

  afterEach(() => {
    process.env.HYDRUS_FILES_PATH = originalEnv;
  });

  describe('buildFilePath', () => {
    it('should build correct path with hash prefix (f{hash[0:2]})', () => {
      process.env.HYDRUS_FILES_PATH = '/hydrus/files';
      const hash = 'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234';

      const result = buildFilePath(hash, '.png');

      expect(result).toBe(path.join('/hydrus/files', 'fab', `${hash}.png`));
    });

    it('should handle uppercase hash with lowercase prefix', () => {
      process.env.HYDRUS_FILES_PATH = '/hydrus/files';
      const hash = 'ABCD1234567890ABCD1234567890ABCD1234567890ABCD1234567890ABCD1234';

      const result = buildFilePath(hash, '.jpg');

      expect(result).toContain('fab');
      expect(result).toContain(hash);
    });

    it('should handle empty HYDRUS_FILES_PATH', () => {
      process.env.HYDRUS_FILES_PATH = '';
      const hash = 'abcd1234';

      const result = buildFilePath(hash, '.png');

      expect(result).toBe(path.join('fab', `${hash}.png`));
    });

    it.each(['.png', '.jpg', '.gif', '.mp4', '.webm'])('should handle %s extension', (extension) => {
      process.env.HYDRUS_FILES_PATH = '/files';
      const hash = 'deadbeef';

      expect(buildFilePath(hash, extension)).toContain(extension);
    });
  });

  describe('buildThumbnailPath', () => {
    it('should build correct path with t prefix and .thumbnail extension', () => {
      process.env.HYDRUS_FILES_PATH = '/hydrus/files';
      const hash = 'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234';

      const result = buildThumbnailPath(hash);

      expect(result).toBe(path.join('/hydrus/files', 'tab', `${hash}.thumbnail`));
    });

    it('should handle uppercase hash with lowercase prefix', () => {
      process.env.HYDRUS_FILES_PATH = '/files';
      const hash = 'ABCD1234';

      const result = buildThumbnailPath(hash);

      expect(result).toContain('tab');
    });

    it('should handle empty HYDRUS_FILES_PATH', () => {
      process.env.HYDRUS_FILES_PATH = '';
      const hash = 'ff0011';

      const result = buildThumbnailPath(hash);

      expect(result).toBe(path.join('tff', `${hash}.thumbnail`));
    });
  });

});
