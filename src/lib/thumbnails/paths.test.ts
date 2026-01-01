import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { sep } from "path";
import {
  getThumbnailBasePath,
  getThumbnailPath,
  getThumbnailRelativePath,
  getHydrusThumbnailPath,
} from "./paths";
import { ThumbnailSize } from "./types";

describe("thumbnail paths", () => {
  const originalThumbnailPath = process.env.THUMBNAIL_PATH;
  const originalFilesPath = process.env.HYDRUS_FILES_PATH;
  const testHash = "abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234";

  afterEach(() => {
    process.env.THUMBNAIL_PATH = originalThumbnailPath;
    process.env.HYDRUS_FILES_PATH = originalFilesPath;
  });

  describe("getThumbnailBasePath", () => {
    it("should use THUMBNAIL_PATH env variable when set", () => {
      process.env.THUMBNAIL_PATH = "/custom/thumbnails";

      const result = getThumbnailBasePath();

      expect(result).toBe("/custom/thumbnails");
    });

    it("should default to cwd/data/thumbnails when THUMBNAIL_PATH is not set", () => {
      delete process.env.THUMBNAIL_PATH;

      const result = getThumbnailBasePath();

      expect(result).toBe(`${process.cwd()}${sep}data${sep}thumbnails`);
    });

    it("should handle empty THUMBNAIL_PATH by using default", () => {
      process.env.THUMBNAIL_PATH = "";

      const result = getThumbnailBasePath();

      // Empty string is falsy, so it uses the default
      expect(result).toBe(`${process.cwd()}${sep}data${sep}thumbnails`);
    });
  });

  describe("getThumbnailPath", () => {
    beforeEach(() => {
      process.env.THUMBNAIL_PATH = "/thumbnails";
    });

    it("should build correct path for GRID size", () => {
      const result = getThumbnailPath(testHash, ThumbnailSize.GRID);

      expect(result).toBe(`/thumbnails${sep}grid${sep}ab${sep}${testHash}.webp`);
    });

    it("should build correct path for PREVIEW size", () => {
      const result = getThumbnailPath(testHash, ThumbnailSize.PREVIEW);

      expect(result).toBe(`/thumbnails${sep}preview${sep}ab${sep}${testHash}.webp`);
    });

    it("should build correct path for ANIMATED size", () => {
      const result = getThumbnailPath(testHash, ThumbnailSize.ANIMATED);

      expect(result).toBe(`/thumbnails${sep}animated${sep}ab${sep}${testHash}.webp`);
    });

    it("should use lowercase prefix from hash", () => {
      const upperHash = "ABCD1234567890ABCD1234567890ABCD1234567890ABCD1234567890ABCD1234";

      const result = getThumbnailPath(upperHash, ThumbnailSize.GRID);

      expect(result).toContain(`${sep}ab${sep}`);
    });

    it("should handle short hashes", () => {
      const shortHash = "ff";

      const result = getThumbnailPath(shortHash, ThumbnailSize.GRID);

      expect(result).toBe(`/thumbnails${sep}grid${sep}ff${sep}${shortHash}.webp`);
    });
  });

  describe("getThumbnailRelativePath", () => {
    it("should build correct relative path for GRID size", () => {
      const result = getThumbnailRelativePath(testHash, ThumbnailSize.GRID);

      expect(result).toBe(`grid${sep}ab${sep}${testHash}.webp`);
    });

    it("should build correct relative path for PREVIEW size", () => {
      const result = getThumbnailRelativePath(testHash, ThumbnailSize.PREVIEW);

      expect(result).toBe(`preview${sep}ab${sep}${testHash}.webp`);
    });

    it("should build correct relative path for ANIMATED size", () => {
      const result = getThumbnailRelativePath(testHash, ThumbnailSize.ANIMATED);

      expect(result).toBe(`animated${sep}ab${sep}${testHash}.webp`);
    });

    it("should use lowercase prefix", () => {
      const upperHash = "FFEE1234";

      const result = getThumbnailRelativePath(upperHash, ThumbnailSize.PREVIEW);

      expect(result).toContain(`${sep}ff${sep}`);
    });

    it("should not include base path", () => {
      process.env.THUMBNAIL_PATH = "/custom/path";

      const result = getThumbnailRelativePath(testHash, ThumbnailSize.GRID);

      expect(result).not.toContain("/custom/path");
      expect(result).not.toContain("thumbnails");
    });
  });

  describe("getHydrusThumbnailPath", () => {
    beforeEach(() => {
      process.env.HYDRUS_FILES_PATH = "/hydrus/files";
    });

    it("should delegate to hydrus buildThumbnailPath", () => {
      const result = getHydrusThumbnailPath(testHash);

      // Uses t{hash[0:2]} prefix and .thumbnail extension
      expect(result).toBe(`/hydrus/files${sep}tab${sep}${testHash}.thumbnail`);
    });

    it("should handle different hashes", () => {
      const hash = "ff00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";

      const result = getHydrusThumbnailPath(hash);

      expect(result).toContain(`tff${sep}`);
      expect(result).toContain(".thumbnail");
    });
  });
});