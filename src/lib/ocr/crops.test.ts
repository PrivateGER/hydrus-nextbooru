import { mkdtemp, readFile, stat, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildInpaintedPageFilePath, deleteCrops, storeInpaintedPage } from './crops';

describe('OCR crop storage', () => {
  let previousThumbnailPath: string | undefined;
  let tempDir: string;

  beforeEach(async () => {
    previousThumbnailPath = process.env.THUMBNAIL_PATH;
    tempDir = await mkdtemp(join(tmpdir(), 'ocr-pages-'));
    process.env.THUMBNAIL_PATH = tempDir;
  });

  afterEach(async () => {
    if (previousThumbnailPath === undefined) {
      delete process.env.THUMBNAIL_PATH;
    } else {
      process.env.THUMBNAIL_PATH = previousThumbnailPath;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  it('stores and deletes a normalized full-page inpaint image for a post hash', async () => {
    const image = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: '#ffffff',
      },
    })
      .png()
      .toBuffer();

    await storeInpaintedPage('ABCDEF', image);

    const path = buildInpaintedPageFilePath('ABCDEF');
    await expect(stat(path)).resolves.toMatchObject({ isFile: expect.any(Function) });
    const stored = await readFile(path);
    expect(stored.subarray(0, 4).toString('ascii')).toBe('RIFF');

    await deleteCrops('ABCDEF');

    await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('removes a stale full-page inpaint image when replacement encoding fails', async () => {
    const image = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: '#ffffff',
      },
    })
      .png()
      .toBuffer();
    await storeInpaintedPage('ABCDEF', image);
    const path = buildInpaintedPageFilePath('ABCDEF');
    await expect(stat(path)).resolves.toMatchObject({ isFile: expect.any(Function) });

    await expect(storeInpaintedPage('ABCDEF', Buffer.from('not an image'))).resolves.toBe(false);

    await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
