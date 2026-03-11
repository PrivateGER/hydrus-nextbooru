import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { writeFile, unlink, mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { computePhash, computePhashFromBuffer, hammingDistance } from "./compute";

/**
 * Create a solid-color test image buffer.
 */
async function createSolidImage(
  width: number,
  height: number,
  color: { r: number; g: number; b: number }
): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: color },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}

/**
 * Create a simple gradient test image (unique visual structure).
 */
async function createGradientImage(
  width: number,
  height: number,
  direction: "horizontal" | "vertical" | "diagonal"
): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      let value: number;
      switch (direction) {
        case "horizontal":
          value = Math.floor((x / width) * 255);
          break;
        case "vertical":
          value = Math.floor((y / height) * 255);
          break;
        case "diagonal":
          value = Math.floor(((x + y) / (width + height)) * 255);
          break;
      }
      pixels[idx] = value;
      pixels[idx + 1] = value;
      pixels[idx + 2] = value;
    }
  }

  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 90 })
    .toBuffer();
}

/**
 * Create a checkerboard pattern image.
 */
async function createCheckerboard(
  width: number,
  height: number,
  blockSize: number
): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      const isWhite =
        (Math.floor(x / blockSize) + Math.floor(y / blockSize)) % 2 === 0;
      const value = isWhite ? 255 : 0;
      pixels[idx] = value;
      pixels[idx + 1] = value;
      pixels[idx + 2] = value;
    }
  }

  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 90 })
    .toBuffer();
}

describe("computePhashFromBuffer", () => {
  it("returns a bigint hash", async () => {
    const img = await createSolidImage(200, 200, { r: 128, g: 128, b: 128 });
    const hash = await computePhashFromBuffer(img);
    expect(hash).not.toBeNull();
    expect(typeof hash).toBe("bigint");
  });

  it("is deterministic — same image always produces the same hash", async () => {
    const img = await createGradientImage(256, 256, "horizontal");
    const hash1 = await computePhashFromBuffer(img);
    const hash2 = await computePhashFromBuffer(img);
    expect(hash1).toBe(hash2);
  });

  it("produces similar hashes for resized variants (distance < 5)", async () => {
    // Create a distinctive image and resize it
    const original = await createCheckerboard(400, 400, 40);
    const resized = await sharp(original).resize(200, 200).jpeg().toBuffer();

    const hashOrig = await computePhashFromBuffer(original);
    const hashResized = await computePhashFromBuffer(resized);
    expect(hashOrig).not.toBeNull();
    expect(hashResized).not.toBeNull();

    const dist = hammingDistance(hashOrig!, hashResized!);
    expect(dist).toBeLessThan(5);
  });

  it("produces similar hashes for recompressed variants (distance < 5)", async () => {
    // Use checkerboard — more robust to compression than smooth gradients
    const original = await createCheckerboard(400, 400, 40);
    const recompressed = await sharp(original)
      .jpeg({ quality: 50 })
      .toBuffer();

    const hashOrig = await computePhashFromBuffer(original);
    const hashRecomp = await computePhashFromBuffer(recompressed);
    expect(hashOrig).not.toBeNull();
    expect(hashRecomp).not.toBeNull();

    const dist = hammingDistance(hashOrig!, hashRecomp!);
    expect(dist).toBeLessThan(5);
  });

  it("produces distant hashes for visually different images (distance > 15)", async () => {
    const checker = await createCheckerboard(300, 300, 30);
    const gradient = await createGradientImage(300, 300, "horizontal");

    const hashChecker = await computePhashFromBuffer(checker);
    const hashGradient = await computePhashFromBuffer(gradient);
    expect(hashChecker).not.toBeNull();
    expect(hashGradient).not.toBeNull();

    const dist = hammingDistance(hashChecker!, hashGradient!);
    expect(dist).toBeGreaterThan(15);
  });

  it("returns null for corrupt data", async () => {
    const corrupt = Buffer.from("not an image at all");
    const hash = await computePhashFromBuffer(corrupt);
    expect(hash).toBeNull();
  });
});

describe("computePhash (file path)", () => {
  it("produces the same hash as computePhashFromBuffer for the same image", async () => {
    const img = await createCheckerboard(300, 300, 30);
    const dir = await mkdtemp(join(tmpdir(), "phash-test-"));
    const filePath = join(dir, "test.jpg");

    try {
      await writeFile(filePath, img);
      const hashFromFile = await computePhash(filePath);
      const hashFromBuffer = await computePhashFromBuffer(img);
      expect(hashFromFile).not.toBeNull();
      expect(hashFromFile).toBe(hashFromBuffer);
    } finally {
      await unlink(filePath).catch(() => {});
      await rm(dir, { recursive: true }).catch(() => {});
    }
  });

  it("returns null for a nonexistent file", async () => {
    const hash = await computePhash("/nonexistent/path/image.jpg");
    expect(hash).toBeNull();
  });
});

describe("hammingDistance", () => {
  it("returns 0 for identical hashes", () => {
    expect(hammingDistance(0n, 0n)).toBe(0);
    expect(hammingDistance(0xdeadbeefn, 0xdeadbeefn)).toBe(0);
  });

  it("counts differing bits correctly", () => {
    // 0b0001 vs 0b0000 = 1 bit different
    expect(hammingDistance(1n, 0n)).toBe(1);
    // 0b1111 vs 0b0000 = 4 bits different
    expect(hammingDistance(0b1111n, 0n)).toBe(4);
  });

  it("is symmetric", () => {
    const a = 0x123456789abcdef0n;
    const b = 0xfedcba9876543210n;
    expect(hammingDistance(a, b)).toBe(hammingDistance(b, a));
  });

  it("returns 64 for maximally different 64-bit hashes", () => {
    const allZeros = 0n;
    const allOnes = (1n << 64n) - 1n;
    expect(hammingDistance(allZeros, allOnes)).toBe(64);
  });

  it("handles negative BigInt values (signed PostgreSQL BIGINT)", () => {
    // Simulate signed BIGINT from PostgreSQL where MSB is set
    const positive = 0n;
    const negative = -1n; // all bits set in two's complement
    // -1n XOR 0n = -1n (negative), but should count as 64 differing bits
    expect(hammingDistance(positive, negative)).toBe(64);

    // Another case: -1n XOR -1n should be 0
    expect(hammingDistance(-1n, -1n)).toBe(0);
  });
});
