import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import { prepareSidecarImage } from './image-prep';

async function jpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: '#ffffff',
    },
  })
    .jpeg()
    .toBuffer();
}

describe('prepareSidecarImage', () => {
  const originalMax = process.env.OCR_MAX_IMAGE_SIDE;

  afterEach(() => {
    if (originalMax === undefined) {
      delete process.env.OCR_MAX_IMAGE_SIDE;
    } else {
      process.env.OCR_MAX_IMAGE_SIDE = originalMax;
    }
  });

  it('keeps small images unchanged so exact source pixels are preserved', async () => {
    process.env.OCR_MAX_IMAGE_SIDE = '2048';
    const image = await jpeg(800, 1200);

    const prepared = await prepareSidecarImage(image, 'image/jpeg');

    expect(prepared.image).toBe(image);
    expect(prepared.mimeType).toBe('image/jpeg');
    expect(prepared.width).toBe(800);
    expect(prepared.height).toBe(1200);
    expect(prepared.resized).toBe(false);
  });

  it('downscales large images to a bounded sidecar copy while preserving aspect ratio', async () => {
    process.env.OCR_MAX_IMAGE_SIDE = '2048';
    const image = await jpeg(6071, 8598);

    const prepared = await prepareSidecarImage(image, 'image/jpeg');
    const meta = await sharp(prepared.image).metadata();

    expect(prepared.image).not.toBe(image);
    expect(prepared.mimeType).toBe('image/jpeg');
    expect(prepared.resized).toBe(true);
    expect(Math.max(prepared.width, prepared.height)).toBe(2048);
    expect(prepared.width).toBe(meta.width);
    expect(prepared.height).toBe(meta.height);
    expect(prepared.width / prepared.height).toBeCloseTo(6071 / 8598, 2);
  });
});
