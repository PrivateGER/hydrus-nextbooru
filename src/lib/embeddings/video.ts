import { spawn } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { readFile, rm } from "fs/promises";
import { randomUUID } from "crypto";
import {
  EMBEDDING_VIDEO_MAX_RESOLUTION,
  EMBEDDING_VIDEO_SAMPLE_WINDOW_COUNT,
  EMBEDDING_VIDEO_SAMPLE_WINDOW_SECONDS,
} from "@/lib/openrouter/types";

/** Gemini samples video at 1 fps; 2 fps keeps a margin without inflating the payload. */
const VIDEO_SAMPLE_FPS = 2;
const MAX_SAMPLE_FRAMES =
  EMBEDDING_VIDEO_SAMPLE_WINDOW_COUNT * EMBEDDING_VIDEO_SAMPLE_WINDOW_SECONDS * VIDEO_SAMPLE_FPS;
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
  sampledRanges: TimeRange[];
}

/**
 * Remove black runs, then choose up to three 10-second windows from the
 * start, middle, and end of the remaining content timeline.
 */
export function planVideoSampleWindows(
  durationSeconds: number,
  blackIntervals: TimeRange[]
): TimeRange[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new RangeError(`Video duration must be positive, got ${durationSeconds}`);
  }

  let content = subtractRanges({ start: 0, end: durationSeconds }, blackIntervals)
    .filter((range) => range.end - range.start >= MIN_CONTENT_INTERVAL_SECONDS);
  if (content.length === 0) {
    content = [{ start: 0, end: durationSeconds }];
  }

  const contentSeconds = content.reduce((sum, range) => sum + (range.end - range.start), 0);
  const budgetSeconds =
    EMBEDDING_VIDEO_SAMPLE_WINDOW_SECONDS * EMBEDDING_VIDEO_SAMPLE_WINDOW_COUNT;
  if (contentSeconds <= budgetSeconds) {
    return content;
  }

  const lastOffset = contentSeconds - EMBEDDING_VIDEO_SAMPLE_WINDOW_SECONDS;
  const offsets = Array.from(
    { length: EMBEDDING_VIDEO_SAMPLE_WINDOW_COUNT },
    (_, index) => index * lastOffset / (EMBEDDING_VIDEO_SAMPLE_WINDOW_COUNT - 1)
  );
  return mergeRanges(offsets.flatMap((offset) =>
    mapContentWindowToRealTime(
      content,
      offset,
      offset + EMBEDDING_VIDEO_SAMPLE_WINDOW_SECONDS
    )
  ));
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

interface ProbeStream {
  codec_type?: string;
  width?: number;
  height?: number;
  duration?: string;
}

interface ProbeData {
  streams?: ProbeStream[];
  format?: { duration?: string };
}

interface VideoProbe {
  durationSeconds: number;
  width: number | null;
  height: number | null;
}

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";
/** A stalled child must not pin a preprocessing slot for the life of the worker. */
const PROCESS_TIMEOUT_MS = 5 * 60_000;

function runProcess(
  command: string,
  args: string[],
  onStderrLine?: (line: string) => void
): Promise<string> {
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
  const stdout: Buffer[] = [];
  const stderrTail: string[] = [];
  let stderrRest = "";
  let processError: Error | undefined;
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGKILL");
  }, PROCESS_TIMEOUT_MS);

  child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
  child.stderr.on("data", (chunk: Buffer) => {
    const lines = (stderrRest + chunk.toString()).split(/\r?\n/);
    stderrRest = lines.pop() ?? "";
    for (const line of lines) {
      onStderrLine?.(line);
      stderrTail.push(line);
      if (stderrTail.length > 5) stderrTail.shift();
    }
  });
  child.on("error", (error) => {
    processError = error;
  });
  child.on("close", (code) => {
    clearTimeout(timer);
    if (stderrRest) {
      onStderrLine?.(stderrRest);
      stderrTail.push(stderrRest);
    }
    if (timedOut) {
      reject(new Error(`${command} timed out after ${PROCESS_TIMEOUT_MS / 1000}s`));
    } else if (processError) {
      reject(processError);
    } else if (code !== 0) {
      reject(new Error(`${command} exited with code ${code}: ${stderrTail.slice(-5).join(" | ")}`));
    } else {
      resolve(Buffer.concat(stdout).toString());
    }
  });
  return promise;
}

async function ffprobe(filePath: string): Promise<ProbeData> {
  const json = await runProcess(FFPROBE, [
    "-v", "error",
    "-print_format", "json",
    "-show_streams",
    "-show_format",
    filePath,
  ]);
  return JSON.parse(json) as ProbeData;
}

/** Both binaries are needed: ffprobe for duration/dims, ffmpeg for detection and transcode. */
export async function isVideoToolingAvailable(): Promise<boolean> {
  const results = await Promise.allSettled([
    runProcess(FFMPEG, ["-version"]),
    runProcess(FFPROBE, ["-version"]),
  ]);
  return results.every((result) => result.status === "fulfilled");
}

async function probeVideo(filePath: string): Promise<VideoProbe> {
  const data = await ffprobe(filePath);
  const stream = data.streams?.find((candidate) => candidate.codec_type === "video");
  if (!stream) {
    throw new Error("File has no video stream");
  }

  const durationSeconds = Number(data.format?.duration ?? stream.duration);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`Could not determine video duration (${data.format?.duration ?? stream.duration})`);
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
async function analyzeLuma(filePath: string): Promise<LumaAnalysis> {
  const blackIntervals: TimeRange[] = [];
  const frames: FrameLuma[] = [];
  let pendingTime: number | null = null;
  const filters = [
    `fps=${ANALYSIS_FPS}`,
    "scale=160:-2",
    `blackdetect=d=${BLACK_MIN_DURATION_SECONDS}:pix_th=${BLACK_PIXEL_THRESHOLD}`,
    "signalstats",
    "metadata=print:key=lavfi.signalstats.YAVG",
  ].join(",");

  await runProcess(
    FFMPEG,
    ["-hide_banner", "-nostdin", "-i", filePath, "-an", "-vf", filters, "-f", "null", "-"],
    (line) => {
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
    }
  );
  return { blackIntervals, frames };
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

async function transcodeSample(
  filePath: string,
  ranges: TimeRange[],
  outputPath: string
): Promise<void> {
  const lastEnd = ranges[ranges.length - 1].end;
  const selectExpr = ranges
    .map((range) => `gte(t,${range.start.toFixed(3)})*lt(t,${range.end.toFixed(3)})`)
    .join("+");
  const filters = [
    `fps=${VIDEO_SAMPLE_FPS}`,
    `select='${selectExpr}'`,
    `trim=end_frame=${MAX_SAMPLE_FRAMES}`,
    `setpts=N/(${VIDEO_SAMPLE_FPS}*TB)`,
    `scale=w='min(${EMBEDDING_VIDEO_MAX_RESOLUTION},iw)':h='min(${EMBEDDING_VIDEO_MAX_RESOLUTION},ih)'` +
      ":force_original_aspect_ratio=decrease:force_divisible_by=2",
  ];

  await runProcess(FFMPEG, [
    "-hide_banner", "-nostdin",
    "-t", (lastEnd + 1).toFixed(3),
    "-i", filePath,
    "-an",
    "-vf", filters.join(","),
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "28",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-f", "mp4",
    "-y", outputPath,
  ]);
}

/**
 * Turn a video file into a small mp4 sample suitable for a video embedding
 * request: black leaders/fades removed, at most
 * {@link EMBEDDING_VIDEO_SAMPLE_WINDOW_COUNT} x {@link EMBEDDING_VIDEO_SAMPLE_WINDOW_SECONDS}
 * seconds, audio stripped, 480p, 2 fps.
 */
export async function preprocessVideoForEmbedding(filePath: string): Promise<ProcessedEmbeddingVideo> {
  const probe = await probeVideo(filePath);
  const analysis = await analyzeLuma(filePath);
  const skipped = extendBlackThroughFades(analysis.blackIntervals, analysis.frames, probe.durationSeconds);
  const ranges = planVideoSampleWindows(probe.durationSeconds, skipped);

  const outputPath = join(tmpdir(), `embed-video-${randomUUID()}.mp4`);
  try {
    await transcodeSample(filePath, ranges, outputPath);
    const [data, output] = await Promise.all([readFile(outputPath), ffprobe(outputPath)]);
    if (data.byteLength > MAX_PROCESSED_BYTES) {
      throw new Error(`Processed video sample is ${data.byteLength} bytes; expected under ${MAX_PROCESSED_BYTES}`);
    }
    const outputStream = output.streams?.find((stream) => stream.codec_type === "video");
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
      sampledRanges: ranges,
    };
  } finally {
    await rm(outputPath, { force: true });
  }
}
