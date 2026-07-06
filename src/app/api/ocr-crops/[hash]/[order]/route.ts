import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { buildCropFilePath } from "@/lib/ocr";

const HASH_PATTERN = /^[a-fA-F0-9]{64}$/;
const ORDER_PATTERN = /^\d{1,4}$/;

/**
 * Serve an inpainted OCR region crop. Immutable cache is safe because the
 * client versions the URL with the scan cropVersion (?v=...).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ hash: string; order: string }> }
) {
  const { hash: rawHash, order } = await params;
  if (!HASH_PATTERN.test(rawHash) || !ORDER_PATTERN.test(order)) {
    return NextResponse.json({ error: "Invalid crop reference" }, { status: 400 });
  }

  const filePath = buildCropFilePath(rawHash.toLowerCase(), Number.parseInt(order, 10));
  try {
    await stat(filePath);
  } catch {
    return NextResponse.json({ error: "Crop not found" }, { status: 404 });
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
