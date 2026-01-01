import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdir, rm, stat, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { execSync, spawnSync } from "child_process";
import {
  isFfmpegAvailable,
  extractVideoFrame,
  generateAnimatedPreview,
} from "./video-extractor";

// Synchronous check for ffmpeg at module load time (for skipIf)
function checkFfmpegSync(): boolean {
  try {
    const result = spawnSync("ffmpeg", ["-version"], { stdio: "pipe" });
    return result.status === 0;
  } catch {
    return false;
  }
}

const ffmpegInstalled = checkFfmpegSync();

/**
 * These tests require ffmpeg to be installed on the system.
 * They generate test fixtures programmatically to avoid binary files in the repo.
 */
describe.skipIf(!ffmpegInstalled)("video-extractor", () => {
  let testDir: string;
  let testVideoPath: string;
  let testGifPath: string;

  beforeAll(async () => {
    // Create temp directory for test fixtures
    testDir = join(tmpdir(), `video-extractor-test-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });

    // Generate a 3-second test video (colored frames)
    testVideoPath = join(testDir, "test-video.mp4");
    execSync(
      `ffmpeg -f lavfi -i "color=c=blue:size=320x240:rate=10:duration=3" -c:v libx264 -pix_fmt yuv420p -y "${testVideoPath}"`,
      { stdio: "pipe" }
    );

    // Generate a simple animated GIF
    testGifPath = join(testDir, "test-anim.gif");
    execSync(
      `ffmpeg -f lavfi -i "color=c=red:size=100x100:rate=5:duration=2" -y "${testGifPath}"`,
      { stdio: "pipe" }
    );
  });

  afterAll(async () => {
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe("isFfmpegAvailable", () => {
    it("should return true when ffmpeg is installed", async () => {
      const available = await isFfmpegAvailable();
      expect(available).toBe(true);
    });
  });

  describe("extractVideoFrame", () => {
    it("should extract a frame from video as PNG buffer", async () => {
      const buffer = await extractVideoFrame(testVideoPath);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // Check PNG magic bytes
      const pngMagic = buffer.slice(0, 8);
      expect(pngMagic[0]).toBe(0x89);
      expect(pngMagic[1]).toBe(0x50); // P
      expect(pngMagic[2]).toBe(0x4e); // N
      expect(pngMagic[3]).toBe(0x47); // G
    });

    it("should clean up temp files after extraction", async () => {
      const tmpBefore = await readTmpDir();
      await extractVideoFrame(testVideoPath);
      const tmpAfter = await readTmpDir();

      // Should not leave behind thumb-*.png files
      const thumbFilesBefore = tmpBefore.filter((f) => f.startsWith("thumb-"));
      const thumbFilesAfter = tmpAfter.filter((f) => f.startsWith("thumb-"));
      expect(thumbFilesAfter.length).toBe(thumbFilesBefore.length);
    });

    it("should reject for non-existent file", async () => {
      await expect(extractVideoFrame("/nonexistent/video.mp4")).rejects.toThrow();
    });

    it("should reject for invalid video file", async () => {
      const invalidPath = join(testDir, "invalid.mp4");
      await require("fs/promises").writeFile(invalidPath, "not a video");

      await expect(extractVideoFrame(invalidPath)).rejects.toThrow();
    });
  });

  describe("generateAnimatedPreview", () => {
    it("should generate animated WebP from short video (<5s)", async () => {
      const outputPath = join(testDir, "preview-short.webp");

      await generateAnimatedPreview(testVideoPath, outputPath, {
        durationMs: 3000, // 3 second video
        isGif: false,
      });

      const stats = await stat(outputPath);
      expect(stats.size).toBeGreaterThan(0);

      // Check WebP magic bytes (RIFF....WEBP)
      const buffer = await readFile(outputPath);
      expect(buffer.slice(0, 4).toString()).toBe("RIFF");
      expect(buffer.slice(8, 12).toString()).toBe("WEBP");
    });

    it("should generate animated WebP from GIF", async () => {
      const outputPath = join(testDir, "preview-gif.webp");

      await generateAnimatedPreview(testGifPath, outputPath, {
        durationMs: 2000,
        isGif: true,
      });

      const stats = await stat(outputPath);
      expect(stats.size).toBeGreaterThan(0);

      const buffer = await readFile(outputPath);
      expect(buffer.slice(0, 4).toString()).toBe("RIFF");
      expect(buffer.slice(8, 12).toString()).toBe("WEBP");
    });

    it("should generate preview from medium video (5-15s)", async () => {
      // Create a 10-second video
      const mediumVideoPath = join(testDir, "medium-video.mp4");
      execSync(
        `ffmpeg -f lavfi -i "color=c=green:size=160x120:rate=10:duration=10" -c:v libx264 -pix_fmt yuv420p -y "${mediumVideoPath}"`,
        { stdio: "pipe" }
      );

      const outputPath = join(testDir, "preview-medium.webp");

      await generateAnimatedPreview(mediumVideoPath, outputPath, {
        durationMs: 10000,
        isGif: false,
      });

      const stats = await stat(outputPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it("should generate multi-segment preview from long video (>15s)", async () => {
      // Create a 20-second video
      const longVideoPath = join(testDir, "long-video.mp4");
      execSync(
        `ffmpeg -f lavfi -i "color=c=yellow:size=160x120:rate=10:duration=20" -c:v libx264 -pix_fmt yuv420p -y "${longVideoPath}"`,
        { stdio: "pipe" }
      );

      const outputPath = join(testDir, "preview-long.webp");

      await generateAnimatedPreview(longVideoPath, outputPath, {
        durationMs: 20000,
        isGif: false,
      });

      const stats = await stat(outputPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it("should clean up temp files for multi-segment videos", async () => {
      const longVideoPath = join(testDir, "long-video.mp4");
      const outputPath = join(testDir, "preview-cleanup-test.webp");

      await generateAnimatedPreview(longVideoPath, outputPath, {
        durationMs: 20000,
        isGif: false,
      });

      // Check no animated-* directories left in tmp
      const tmpContents = await readTmpDir();
      const animatedDirs = tmpContents.filter((f) => f.startsWith("animated-"));
      expect(animatedDirs.length).toBe(0);
    });
  });
});

async function readTmpDir(): Promise<string[]> {
  const { readdir } = await import("fs/promises");
  try {
    return await readdir(tmpdir());
  } catch {
    return [];
  }
}