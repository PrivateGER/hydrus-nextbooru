/**
 * Deterministic synthetic data generators for perf seeding:
 * embedding vectors, perceptual hashes, and note text.
 */

/**
 * Pseudo-random unit vector (L2-normalized) of the given dimension.
 * Components are centered via Box-Muller so directions are uniform on
 * the hypersphere — matching how real embedding vectors distribute for
 * cosine-distance search.
 */
export function unitVector(dimensions: number, rng: () => number): number[] {
  const v = new Array<number>(dimensions);
  for (let i = 0; i < dimensions; i += 2) {
    // Box-Muller transform: two uniforms -> two standard normals.
    const u1 = Math.max(rng(), Number.MIN_VALUE);
    const u2 = rng();
    const r = Math.sqrt(-2 * Math.log(u1));
    v[i] = r * Math.cos(2 * Math.PI * u2);
    if (i + 1 < dimensions) {
      v[i + 1] = r * Math.sin(2 * Math.PI * u2);
    }
  }

  let norm = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0));
  if (norm === 0) norm = 1;
  return v.map((x) => x / norm);
}

/** Random 64-bit perceptual hash as a signed bigint (Postgres BIGINT). */
export function randomPhash(rng: () => number): bigint {
  const hi = BigInt(Math.floor(rng() * 0x100000000));
  const lo = BigInt(Math.floor(rng() * 0x100000000));
  const unsigned = (hi << 32n) | lo;
  // Map [0, 2^64) onto signed BIGINT range [-2^63, 2^63).
  return BigInt.asIntN(64, unsigned);
}

/** Small fixed vocabulary; word frequency follows the rng's draws. */
const VOCABULARY = [
  'sunset', 'river', 'portrait', 'sketch', 'commission', 'character',
  'translation', 'dialogue', 'caption', 'artist', 'comment', 'source',
  'original', 'chapter', 'page', 'detail', 'lighting', 'background',
  'forest', 'city', 'night', 'morning', 'study', 'reference', 'palette',
  'lineart', 'shading', 'draft', 'final', 'revision', 'notes', 'speech',
  'bubble', 'panel', 'cover', 'illustration', 'scene', 'pose', 'outfit',
  'expression',
];

/** Deterministic multi-word note text with the requested word count. */
export function noteContent(rng: () => number, words: number): string {
  const parts = new Array<string>(words);
  for (let i = 0; i < words; i++) {
    parts[i] = VOCABULARY[Math.floor(rng() * VOCABULARY.length)];
  }
  return parts.join(' ');
}
