import ffmpeg from "fluent-ffmpeg";
import { tmpdir } from "os";
import { join } from "path";
import { readFile, unlink } from "fs/promises";
import { randomUUID } from "crypto";

// Set ffmpeg path if environment variable is provided
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}

/**
 * Extract a frame from a video file as a buffer.
 * Extracts at 1 second or 10% into the video, whichever is smaller.
 *
 * @param videoPath - Full path to the video file
 * @param durationMs - Optional duration in milliseconds for position calculation
 * @returns Buffer containing the extracted frame as PNG
 */
export async function extractVideoFrame(
  videoPath: string,
  durationMs?: number
): Promise<Buffer> {
  // Calculate timestamp: 1 second or 10% into video, whichever is smaller
  let timestamp = 1;
  if (durationMs && durationMs > 0) {
    const tenPercent = (durationMs / 1000) * 0.1;
    timestamp = Math.min(1, tenPercent);
  }

  // Use temp file for extraction
  const tempPath = join(tmpdir(), `thumb-${randomUUID()}.png`);

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(timestamp)
        .frames(1)
        .outputOptions(["-vf", "scale=iw:ih"]) // Keep original dimensions
        .output(tempPath)
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });

    // Read the extracted frame
    const buffer = await readFile(tempPath);
    return buffer;
  } finally {
    // Clean up temp file
    try {
      await unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Check if ffmpeg is available on the system.
 */
export async function isFfmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    ffmpeg.getAvailableFormats((err) => {
      resolve(!err);
    });
  });
}
