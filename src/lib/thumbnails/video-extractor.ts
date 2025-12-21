import ffmpeg from "fluent-ffmpeg";
import { tmpdir } from "os";
import { join } from "path";
import { readFile, unlink, writeFile, mkdir } from "fs/promises";
import { randomUUID } from "crypto";
import { ANIMATED_PREVIEW_CONFIG, THUMBNAIL_DIMENSIONS } from "./types";

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

export interface AnimatedPreviewOptions {
  /** Duration of the source media in milliseconds */
  durationMs: number;
  /** Whether the source is a GIF (uses different processing) */
  isGif?: boolean;
}

/**
 * Generate an animated WebP preview from a video or GIF file.
 *
 * Uses smart sampling based on video duration:
 * - Videos > 15s: Extract 3 clips from 20%, 50%, 80% points
 * - Videos 5-15s: Extract from 25% point for 5 seconds
 * - Videos < 5s: Use entire video
 * - GIFs: Convert to lower fps animated WebP
 *
 * @param inputPath - Full path to the video or GIF file
 * @param outputPath - Full path for the output WebP file
 * @param options - Configuration options
 */
export async function generateAnimatedPreview(
  inputPath: string,
  outputPath: string,
  options: AnimatedPreviewOptions
): Promise<void> {
  const { durationMs, isGif = false } = options;
  const durationSec = durationMs / 1000;
  const config = ANIMATED_PREVIEW_CONFIG;
  const width = THUMBNAIL_DIMENSIONS.ANIMATED;

  if (isGif) {
    // For GIFs: Convert to animated WebP at lower fps
    await generateGifPreview(inputPath, outputPath, width, config);
  } else if (durationSec > 15) {
    // Long videos: Smart sampling from multiple points
    await generateMultiSegmentPreview(inputPath, outputPath, durationSec, width, config);
  } else if (durationSec > 5) {
    // Medium videos: Single segment from 25% point
    const startTime = durationSec * 0.25;
    await generateSingleSegmentPreview(inputPath, outputPath, startTime, config.duration, width, config);
  } else {
    // Short videos: Use entire video
    await generateSingleSegmentPreview(inputPath, outputPath, 0, durationSec, width, config);
  }
}

/**
 * Generate animated preview from a GIF file.
 */
async function generateGifPreview(
  inputPath: string,
  outputPath: string,
  width: number,
  config: typeof ANIMATED_PREVIEW_CONFIG
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-vf",
        `fps=${config.fps},scale=${width}:-1:flags=lanczos`,
        "-loop",
        "0",
        "-quality",
        config.quality.toString(),
        "-compression_level",
        "6",
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

/**
 * Generate animated preview from a single segment of the video.
 */
async function generateSingleSegmentPreview(
  inputPath: string,
  outputPath: string,
  startTime: number,
  duration: number,
  width: number,
  config: typeof ANIMATED_PREVIEW_CONFIG
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const cmd = ffmpeg(inputPath);

    if (startTime > 0) {
      cmd.seekInput(startTime);
    }

    cmd
      .duration(duration)
      .outputOptions([
        "-vf",
        `fps=${config.fps},scale=${width}:-1:flags=lanczos`,
        "-loop",
        "0",
        "-quality",
        config.quality.toString(),
        "-compression_level",
        "6",
        "-an", // No audio
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

/**
 * Generate animated preview by sampling multiple segments from the video.
 * Creates 3 clips from 20%, 50%, and 80% points and concatenates them.
 */
async function generateMultiSegmentPreview(
  inputPath: string,
  outputPath: string,
  durationSec: number,
  width: number,
  config: typeof ANIMATED_PREVIEW_CONFIG
): Promise<void> {
  const tempDir = join(tmpdir(), `animated-${randomUUID()}`);
  await mkdir(tempDir, { recursive: true });

  const segmentDuration = config.duration / config.samplePoints;
  const samplePoints = [0.2, 0.5, 0.8]; // 20%, 50%, 80% of video
  const segmentPaths: string[] = [];

  try {
    // Generate each segment
    for (let i = 0; i < samplePoints.length; i++) {
      const startTime = durationSec * samplePoints[i];
      const segmentPath = join(tempDir, `segment-${i}.webm`);
      segmentPaths.push(segmentPath);

      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .seekInput(startTime)
          .duration(segmentDuration)
          .outputOptions([
            "-vf",
            `fps=${config.fps},scale=${width}:-1:flags=lanczos`,
            "-c:v",
            "libvpx-vp9",
            "-b:v",
            "0",
            "-crf",
            "30",
            "-an",
          ])
          .output(segmentPath)
          .on("end", () => resolve())
          .on("error", (err) => reject(err))
          .run();
      });
    }

    // Create concat file
    const concatFilePath = join(tempDir, "concat.txt");
    const concatContent = segmentPaths.map((p) => `file '${p}'`).join("\n");
    await writeFile(concatFilePath, concatContent);

    // Concatenate segments and convert to animated WebP
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(concatFilePath)
        .inputOptions(["-f", "concat", "-safe", "0"])
        .outputOptions([
          "-loop",
          "0",
          "-quality",
          config.quality.toString(),
          "-compression_level",
          "6",
        ])
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });
  } finally {
    // Clean up temp files
    for (const segmentPath of segmentPaths) {
      try {
        await unlink(segmentPath);
      } catch {
        // Ignore cleanup errors
      }
    }
    try {
      await unlink(join(tempDir, "concat.txt"));
    } catch {
      // Ignore cleanup errors
    }
    try {
      await unlink(tempDir);
    } catch {
      // Ignore cleanup errors (directory may not be empty)
    }
  }
}
