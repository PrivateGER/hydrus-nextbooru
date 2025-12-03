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
 * Extract a representative frame from a video file as a buffer.
 * Uses ffmpeg's thumbnail filter to automatically select the most
 * visually interesting frame from the video.
 *
 * @param videoPath - Full path to the video file
 * @returns Buffer containing the extracted frame as PNG
 */
export async function extractVideoFrame(videoPath: string): Promise<Buffer> {
  // Use temp file for extraction
  const tempPath = join(tmpdir(), `thumb-${randomUUID()}.png`);

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions(["-vf", "thumbnail", "-frames:v", "1"])
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
