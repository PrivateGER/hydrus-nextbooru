import ffmpeg, { type FfprobeData } from "fluent-ffmpeg";
import { spawn } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { readFile, rm } from "fs/promises";
import { randomUUID } from "crypto";
import {
  EMBEDDING_VIDEO_SAMPLE_WINDOW_COUNT,
  EMBEDDING_VIDEO_SAMPLE_WINDOW_SECONDS,
} from "@/lib/openrouter/types";

if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}
if (process.env.FFPROBE_PATH) {
  ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
}

/** Gemini samples video at 1 fps; 2 fps keeps a margin without inflating the payload. */
const VIDEO_SAMPLE_FPS = 2;
/** Token count is resolution-independent (measured 320p vs 720p), so keep the payload small. */
const VIDEO_SAMPLE_MAX_RESOLUTION = 480;
/** Shortest black run worth cutting; fades produce sub-second runs. */
const BLACK_MIN_DURATION_SECONDS = 0.2;
/**
 * ffmpeg's default luma threshold. Kept conservative: with pic_th 0.98 it
 * still catches leaders and the darker half of fades without swallowing
 * intentionally dark footage.
 */
const BLACK_PIXEL_THRESHOLD = 0.1;
const MIN_CONTENT_INTERVAL_SECONDS = 0.5;
/** A 30 s / 480p / 2 fps clip is ~300 KB; anything near this indicates a broken transcode. */
const MAX_PROCESSED_BYTES = 8 * 1024 * 1024;

export interface TimeRange {
  start: number;
  end: number;
}

export interface ProcessedEmbeddingVideo {
  dataUrl: string;
  format: "mp4";
  sourceWidth: number | null;
  sourceHeight: number | null;
  processedWidth: number;
  processedHeight: number;
  byteLength: number;
  sourceDurationSeconds: number;
  sampledRanges: TimeRange[];
}

export interface VideoSamplePlanOptions {
  windowSeconds: number;
  windowCount: number;
}

/**
 * Choose which real-time ranges of a video to embed.
 *
 * Black runs (leaders, fades, trailers) are removed to form a "content
 * timeline". If the remaining content fits the sample budget it is embedded
 * whole; otherwise `windowCount` windows of `windowSeconds` are spread evenly
 * across the content timeline (first at its start, last at its end) and mapped
 * back to real time, so a window straddling a black run yields two ranges.
 * A video that is entirely black falls back to its full duration.
 */
export function planVideoSampleWindows(
  durationSeconds: number,
  blackIntervals: TimeRange[],
  options: VideoSamplePlanOptions = {
    windowSeconds: EMBEDDING_VIDEO_SAMPLE_WINDOW_SECONDS,
    windowCount: EMBEDDING_VIDEO_SAMPLE_WINDOW_COUNT,
  }
): TimeRange[] {
  const { windowSeconds, windowCount } = options;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new RangeError(`Video duration must be positive, got ${durationSeconds}`);
  }
  if (!(windowSeconds > 0) || !Number.isInteger(windowCount) || windowCount < 1) {
    throw new RangeError("Invalid sample window options");
  }

  let content = subtractRanges({ start: 0, end: durationSeconds }, blackIntervals)
    .filter((range) => range.end - range.start >= MIN_CONTENT_INTERVAL_SECONDS);
  if (content.length === 0) {
    content = [{ start: 0, end: durationSeconds }];
  }

  const contentSeconds = content.reduce((sum, range) => sum + (range.end - range.start), 0);
  const budgetSeconds = windowSeconds * windowCount;
  if (contentSeconds <= budgetSeconds) {
    return content;
  }

  const lastOffset = contentSeconds - windowSeconds;
  const offsets = windowCount === 1
    ? [0]
    : Array.from({ length: windowCount }, (_, index) => (index * lastOffset) / (windowCount - 1));

  const ranges = offsets.flatMap((offset) =>
    mapContentWindowToRealTime(content, offset, offset + windowSeconds)
  );
  return mergeRanges(ranges);
}

/** Remove `cuts` from `span`; result is sorted and non-overlapping. */
function subtractRanges(span: TimeRange, cuts: TimeRange[]): TimeRange[] {
  const sortedCuts = mergeRanges(
    cuts
      .map((cut) => ({ start: Math.max(span.start, cut.start), end: Math.min(span.end, cut.end) }))
      .filter((cut) => cut.end > cut.start)
  );

  const result: TimeRange[] = [];
  let cursor = span.start;
  for (const cut of sortedCuts) {
    if (cut.start > cursor) {
      result.push({ start: cursor, end: cut.start });
    }
    cursor = Math.max(cursor, cut.end);
  }
  if (cursor < span.end) {
    result.push({ start: cursor, end: span.end });
  }
  return result;
}

/** Map a [from, to) window on the concatenated content timeline back to real-time ranges. */
function mapContentWindowToRealTime(content: TimeRange[], from: number, to: number): TimeRange[] {
  const result: TimeRange[] = [];
  let cursor = 0;
  for (const range of content) {
    const length = range.end - range.start;
    const overlapStart = Math.max(from, cursor);
    const overlapEnd = Math.min(to, cursor + length);
    if (overlapEnd > overlapStart) {
      result.push({
        start: range.start + (overlapStart - cursor),
        end: range.start + (overlapEnd - cursor),
      });
    }
    cursor += length;
    if (cursor >= to) break;
  }
  return result;
}

function mergeRanges(ranges: TimeRange[]): TimeRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: TimeRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

interface VideoProbe {
  durationSeconds: number;
  width: number | null;
  height: number | null;
}

function ffprobe(filePath: string): Promise<FfprobeData> {
  const { promise, resolve, reject } = Promise.withResolvers<FfprobeData>();
  ffmpeg.ffprobe(filePath, (error, data) => (error ? reject(error) : resolve(data)));
  return promise;
}

function executableRuns(command: string): Promise<boolean> {
  const { promise, resolve } = Promise.withResolvers<boolean>();
  const child = spawn(command, ["-version"], { stdio: "ignore" });
  child.on("error", () => resolve(false));
  child.on("exit", (code) => resolve(code === 0));
  return promise;
}

/** Both binaries are needed: ffprobe for duration/dims, ffmpeg for detection and transcode. */
export async function isVideoToolingAvailable(): Promise<boolean> {
  const [ffmpegOk, ffprobeOk] = await Promise.all([
    executableRuns(process.env.FFMPEG_PATH || "ffmpeg"),
    executableRuns(process.env.FFPROBE_PATH || "ffprobe"),
  ]);
  return ffmpegOk && ffprobeOk;
}

async function probeVideo(filePath: string): Promise<VideoProbe> {
  const data = await ffprobe(filePath);
  const stream = data.streams.find((candidate) => candidate.codec_type === "video");
  if (!stream) {
    throw new Error("File has no video stream");
  }

  const durationSeconds = Number(data.format.duration ?? stream.duration);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`Could not determine video duration (${data.format.duration ?? stream.duration})`);
  }

  return {
    durationSeconds,
    width: typeof stream.width === "number" ? stream.width : null,
    height: typeof stream.height === "number" ? stream.height : null,
  };
}

const BLACK_INTERVAL_PATTERN = /black_start:\s*([\d.]+)\s+black_end:\s*([\d.]+)/;
const FRAME_TIME_PATTERN = /\bpts_time:([\d.]+)/;
const FRAME_LUMA_PATTERN = /lavfi\.signalstats\.YAVG=([\d.]+)/;
/** Frames per second analyzed for black runs and luma ramps. */
const ANALYSIS_FPS = 10;
/** Limited-range luma: black is 16, white 235. A fade frame is at most 30% of the way up. */
const FADE_LUMA_MAX = 16 + 0.3 * 219;
/** Consecutive fade frames must brighten by at least this much; flat dark scenes do not. */
const FADE_MIN_STEP = 0.5;
/** A single brighter frame after black is a cut into a dark scene, not a fade. */
const FADE_MIN_FRAMES = 2;

export interface FrameLuma {
  time: number;
  luma: number;
}

interface LumaAnalysis {
  blackIntervals: TimeRange[];
  frames: FrameLuma[];
}

/**
 * One decode pass at thumbnail scale: ffmpeg reports strict black runs and
 * per-frame average luma on stderr.
 */
function analyzeLuma(filePath: string): Promise<LumaAnalysis> {
  const { promise, resolve, reject } = Promise.withResolvers<LumaAnalysis>();
  const blackIntervals: TimeRange[] = [];
  const frames: FrameLuma[] = [];
  let pendingTime: number | null = null;
  ffmpeg(filePath)
    .noAudio()
    .videoFilters([
      `fps=${ANALYSIS_FPS}`,
      "scale=160:-2",
      `blackdetect=d=${BLACK_MIN_DURATION_SECONDS}:pix_th=${BLACK_PIXEL_THRESHOLD}`,
      "signalstats",
      "metadata=print:key=lavfi.signalstats.YAVG",
    ])
    .outputOptions(["-f", "null"])
    .output("-")
    .on("stderr", (line: string) => {
      const black = BLACK_INTERVAL_PATTERN.exec(line);
      if (black) {
        blackIntervals.push({ start: Number(black[1]), end: Number(black[2]) });
        return;
      }
      const time = FRAME_TIME_PATTERN.exec(line);
      if (time) {
        pendingTime = Number(time[1]);
        return;
      }
      const luma = FRAME_LUMA_PATTERN.exec(line);
      if (luma && pendingTime !== null) {
        frames.push({ time: pendingTime, luma: Number(luma[1]) });
        pendingTime = null;
      }
    })
    .on("end", () => resolve({ blackIntervals, frames }))
    .on("error", reject)
    .run();
  return promise;
}

/**
 * Grow each strict black run outward through adjacent fade ramps: at least
 * {@link FADE_MIN_FRAMES} frames that stay dark and brighten monotonically
 * away from the black. A dark scene with flat luma is left alone even when it
 * borders black, and dark footage with no black neighbour is never touched.
 */
export function extendBlackThroughFades(
  blackIntervals: TimeRange[],
  frames: FrameLuma[],
  durationSeconds: number
): TimeRange[] {
  if (frames.length === 0) return mergeRanges(blackIntervals);

  /** Number of frames from `from` (stepping by `step`) that form a brightening ramp. */
  const rampLength = (from: number, step: 1 | -1): number => {
    let previous = from - step >= 0 && from - step < frames.length ? frames[from - step].luma : 16;
    let length = 0;
    for (let index = from; index >= 0 && index < frames.length; index += step) {
      const { luma } = frames[index];
      if (luma > FADE_LUMA_MAX || luma < previous + FADE_MIN_STEP) break;
      previous = luma;
      length++;
    }
    return length >= FADE_MIN_FRAMES ? length : 0;
  };

  return mergeRanges(blackIntervals.map((interval) => {
    let { start, end } = interval;

    const forwardFrom = frames.findIndex((frame) => frame.time >= interval.end);
    if (forwardFrom >= 0) {
      const length = rampLength(forwardFrom, 1);
      if (length > 0) {
        const last = forwardFrom + length - 1;
        end = last + 1 < frames.length ? frames[last + 1].time : durationSeconds;
      }
    }

    const backwardFrom = frames.findLastIndex((frame) => frame.time < interval.start);
    if (backwardFrom >= 0) {
      const length = rampLength(backwardFrom, -1);
      if (length > 0) {
        start = frames[backwardFrom - length + 1].time;
      }
    }

    return { start, end };
  }));
}

function transcodeSample(
  filePath: string,
  ranges: TimeRange[],
  durationSeconds: number,
  outputPath: string
): Promise<void> {
  const coversWholeVideo =
    ranges.length === 1 && ranges[0].start <= 0 && ranges[0].end >= durationSeconds;
  const lastEnd = ranges[ranges.length - 1].end;

  const filters = [`fps=${VIDEO_SAMPLE_FPS}`];
  if (!coversWholeVideo) {
    const selectExpr = ranges
      .map((range) => `gte(t,${range.start.toFixed(3)})*lt(t,${range.end.toFixed(3)})`)
      .join("+");
    filters.push(`select='${selectExpr}'`, `setpts=N/(${VIDEO_SAMPLE_FPS}*TB)`);
  }
  filters.push(
    `scale=w='min(${VIDEO_SAMPLE_MAX_RESOLUTION},iw)':h='min(${VIDEO_SAMPLE_MAX_RESOLUTION},ih)'` +
      ":force_original_aspect_ratio=decrease:force_divisible_by=2"
  );

  const { promise, resolve, reject } = Promise.withResolvers<void>();
  const command = ffmpeg(filePath);
  if (!coversWholeVideo) {
    command.inputOptions(["-t", (lastEnd + 1).toFixed(3)]);
  }
  command
    .noAudio()
    .videoFilters(filters)
    .videoCodec("libx264")
    .outputOptions([
      "-preset", "veryfast",
      "-crf", "28",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
    ])
    .format("mp4")
    .output(outputPath)
    .on("end", () => resolve())
    .on("error", reject)
    .run();
  return promise;
}

/**
 * Turn a video file into a small mp4 sample suitable for a video embedding
 * request: black leaders/fades removed, at most
 * {@link EMBEDDING_VIDEO_SAMPLE_WINDOW_COUNT} x {@link EMBEDDING_VIDEO_SAMPLE_WINDOW_SECONDS}
 * seconds, audio stripped, 480p, 2 fps.
 */
export async function preprocessVideoForEmbedding(filePath: string): Promise<ProcessedEmbeddingVideo> {
  const [probe, analysis] = await Promise.all([probeVideo(filePath), analyzeLuma(filePath)]);
  const skipped = extendBlackThroughFades(analysis.blackIntervals, analysis.frames, probe.durationSeconds);
  const ranges = planVideoSampleWindows(probe.durationSeconds, skipped);

  const outputPath = join(tmpdir(), `embed-video-${randomUUID()}.mp4`);
  try {
    await transcodeSample(filePath, ranges, probe.durationSeconds, outputPath);
    const [data, output] = await Promise.all([readFile(outputPath), ffprobe(outputPath)]);
    if (data.byteLength > MAX_PROCESSED_BYTES) {
      throw new Error(`Processed video sample is ${data.byteLength} bytes; expected under ${MAX_PROCESSED_BYTES}`);
    }
    const outputStream = output.streams.find((stream) => stream.codec_type === "video");
    if (!outputStream?.width || !outputStream.height) {
      throw new Error("Processed video sample has no video stream");
    }

    return {
      dataUrl: `data:video/mp4;base64,${data.toString("base64")}`,
      format: "mp4",
      sourceWidth: probe.width,
      sourceHeight: probe.height,
      processedWidth: outputStream.width,
      processedHeight: outputStream.height,
      byteLength: data.byteLength,
      sourceDurationSeconds: probe.durationSeconds,
      sampledRanges: ranges,
    };
  } finally {
    await rm(outputPath, { force: true });
  }
}
