import { NextRequest, NextResponse } from 'next/server';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { Readable } from 'stream';
import { buildInpaintedPageFilePath } from '@/lib/ocr';

const HASH_PATTERN = /^[a-fA-F0-9]{64}$/;

/**
 * Serve a full-page inpainted OCR render. Immutable cache is safe because the
 * client versions the URL with the scan cropVersion (?v=...).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  const { hash: rawHash } = await params;
  if (!HASH_PATTERN.test(rawHash)) {
    return NextResponse.json({ error: 'Invalid page reference' }, { status: 400 });
  }

  const filePath = buildInpaintedPageFilePath(rawHash.toLowerCase());
  try {
    await stat(filePath);
  } catch {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
