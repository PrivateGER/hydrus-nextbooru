import { describe, it, expect } from "vitest";
import { canGenerateAnimatedPreview } from "./generator";
import { ThumbnailStatus } from "./types";

describe("canGenerateAnimatedPreview", () => {
  const basePost = {
    id: 1,
    hash: "a".repeat(64),
    extension: "mp4",
    mimeType: "video/mp4",
    thumbnailStatus: ThumbnailStatus.PENDING,
    duration: null as number | null,
  };

  it("should accept videos, GIFs, and APNGs with duration", () => {
    const eligibleTypes = ["video/mp4", "video/webm", "image/gif", "image/apng"];
    for (const mimeType of eligibleTypes) {
      const post = { ...basePost, mimeType, duration: 5000 };
      expect(canGenerateAnimatedPreview(post)).toBe(true);
    }
  });

  it("should reject static images and non-video media", () => {
    const ineligibleTypes = ["image/jpeg", "image/png", "image/webp", "audio/mp3"];
    for (const mimeType of ineligibleTypes) {
      const post = { ...basePost, mimeType, duration: 10000 };
      expect(canGenerateAnimatedPreview(post)).toBe(false);
    }
  });

  it("should reject media without duration data", () => {
    const post = { ...basePost, mimeType: "video/mp4", duration: null };
    expect(canGenerateAnimatedPreview(post)).toBe(false);
  });

  it("should accept very short videos with duration", () => {
    const post = { ...basePost, mimeType: "video/mp4", duration: 100 };
    expect(canGenerateAnimatedPreview(post)).toBe(true);
  });
});