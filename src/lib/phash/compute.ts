import sharp from "sharp";
import { phashLog } from "@/lib/logger";

// Re-exported from the sharp-free module for existing importers.
export { PHASH_SUPPORTED_MIMES } from "@/lib/phash/mimes";

// =============================================================================
// DCT Coefficient Matrix (pre-computed at module load)
// =============================================================================

const DCT_SIZE = 32;
const HASH_SIZE = 8;

/**
 * Pre-computed DCT-II coefficient matrix for a 32x32 input.
 * dctCoeffs[u][x] = cos((2x + 1) * u * PI / (2 * N))
 *
 * Computing this once avoids repeated trig calls during hashing.
 */
const dctCoeffs: Float64Array[] = new Array(DCT_SIZE);
for (let u = 0; u < DCT_SIZE; u++) {
  dctCoeffs[u] = new Float64Array(DCT_SIZE);
  for (let x = 0; x < DCT_SIZE; x++) {
    dctCoeffs[u][x] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * DCT_SIZE));
  }
}

// =============================================================================
// Core Algorithm
// =============================================================================

/**
 * Compute a 64-bit DCT perceptual hash from raw 32x32 grayscale pixel data.
 *
 * 1. Apply 2D DCT to the 32x32 matrix
 * 2. Extract the top-left 8x8 block (low frequencies)
 * 3. Exclude DC coefficient [0,0]
 * 4. Compute median of the remaining 63 values
 * 5. Threshold each value against the median → 64-bit hash
 *
 * The 64th bit (position for [0,0]) is always 0 since we exclude DC.
 */
function dctHash(pixels: Buffer): bigint {
  // Step 1: 2D DCT — only compute the top-left 8x8 block we need
  const dctValues = new Float64Array(HASH_SIZE * HASH_SIZE);

  for (let u = 0; u < HASH_SIZE; u++) {
    for (let v = 0; v < HASH_SIZE; v++) {
      let sum = 0;
      for (let x = 0; x < DCT_SIZE; x++) {
        const cu = dctCoeffs[u][x];
        for (let y = 0; y < DCT_SIZE; y++) {
          sum += pixels[x * DCT_SIZE + y] * cu * dctCoeffs[v][y];
        }
      }
      dctValues[u * HASH_SIZE + v] = sum;
    }
  }

  // Step 2-3: Extract 63 values (exclude DC at [0,0])
  const acValues = new Float64Array(HASH_SIZE * HASH_SIZE - 1);
  for (let i = 1; i < HASH_SIZE * HASH_SIZE; i++) {
    acValues[i - 1] = dctValues[i];
  }

  // Step 4: Compute median
  const sorted = Float64Array.from(acValues).sort();
  const mid = sorted.length >> 1;
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];

  // Step 5: Threshold → 64-bit hash
  // Bit 63 (MSB, for DC [0,0]) is always 0
  let hash = 0n;
  for (let i = 0; i < acValues.length; i++) {
    if (acValues[i] > median) {
      // Bit position: 62 - i (bit 63 reserved for DC, set to 0)
      hash |= 1n << BigInt(62 - i);
    }
  }

  return hash;
}

/**
 * Compute a perceptual hash from an image file path.
 * Returns null for unsupported formats or on error.
 */
export async function computePhash(imagePath: string): Promise<bigint | null> {
  try {
    const pixels = await sharp(imagePath, {
      limitInputPixels: 268402689,
      sequentialRead: true,
    })
      .resize(DCT_SIZE, DCT_SIZE, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer();

    return dctHash(pixels);
  } catch (err) {
    phashLog.warn(
      { path: imagePath, error: err instanceof Error ? err.message : String(err) },
      "Failed to compute phash from file"
    );
    return null;
  }
}

/**
 * Compute a perceptual hash from an image buffer.
 * Returns null for unsupported formats or on error.
 */
export async function computePhashFromBuffer(
  buffer: Buffer
): Promise<bigint | null> {
  try {
    const pixels = await sharp(buffer, {
      limitInputPixels: 268402689,
      sequentialRead: true,
    })
      .resize(DCT_SIZE, DCT_SIZE, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer();

    return dctHash(pixels);
  } catch (err) {
    phashLog.warn(
      { error: err instanceof Error ? err.message : String(err) },
      "Failed to compute phash from buffer"
    );
    return null;
  }
}

/**
 * Compute the Hamming distance between two 64-bit hashes.
 * Returns the number of differing bits (0 = identical, 64 = maximally different).
 *
 * Masks to 64 bits to handle signed BigInt from PostgreSQL BIGINT columns,
 * where XOR of two values can produce a negative result.
 */
export function hammingDistance(a: bigint, b: bigint): number {
  // Mask to 64 bits — PostgreSQL BIGINT is signed, XOR can be negative
  let xor = (a ^ b) & 0xFFFFFFFFFFFFFFFFn;
  let count = 0;
  // Kernighan's algorithm: clears lowest set bit each iteration
  while (xor > 0n) {
    xor &= xor - 1n;
    count++;
  }
  return count;
}
