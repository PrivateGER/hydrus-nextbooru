import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "child_process";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
  extendBlackThroughFades,
  planVideoSampleWindows,
  preprocessVideoForEmbedding,
  type FrameLuma,
} from "@/lib/embeddings/video";
import {
  EMBEDDING_VIDEO_SAMPLE_WINDOW_COUNT,
  EMBEDDING_VIDEO_SAMPLE_WINDOW_SECONDS,
} from "@/lib/openrouter/types";

const SAMPLE_BUDGET_SECONDS = EMBEDDING_VIDEO_SAMPLE_WINDOW_COUNT * EMBEDDING_VIDEO_SAMPLE_WINDOW_SECONDS;

describe("planVideoSampleWindows", () => {
  it("embeds a short video whole after trimming black leader and trailer", () => {
    expect(planVideoSampleWindows(20, [{ start: 0, end: 2 }, { start: 18.5, end: 20 }])).toEqual([
      { start: 2, end: 18.5 },
    ]);
  });

  it("spreads windows to the start, middle, and end of the content timeline", () => {
    expect(planVideoSampleWindows(100, [])).toEqual([
      { start: 0, end: 10 },
      { start: 45, end: 55 },
      { start: 90, end: 100 },
    ]);
  });

  it("skips black runs when placing windows, splitting a window that straddles one", () => {
    const ranges = planVideoSampleWindows(100, [{ start: 5, end: 8 }, { start: 90, end: 100 }]);
    expect(ranges).toEqual([
      { start: 0, end: 5 },
      { start: 8, end: 13 },
      { start: 41.5, end: 51.5 },
      { start: 80, end: 90 },
    ]);
  });

  it("never exceeds the sample budget", () => {
    for (const duration of [31, 45, 60, 3600]) {
      const ranges = planVideoSampleWindows(duration, [{ start: 0, end: 1 }]);
      const sampled = ranges.reduce((sum, range) => sum + (range.end - range.start), 0);
      expect(sampled).toBeLessThanOrEqual(30 + 1e-9);
    }
  });

  it("falls back to the full duration when the whole video is black", () => {
    expect(planVideoSampleWindows(12, [{ start: 0, end: 12 }])).toEqual([{ start: 0, end: 12 }]);
  });

  it("ignores content slivers between black runs and clamps out-of-range cuts", () => {
    expect(
      planVideoSampleWindows(10, [{ start: -5, end: 3 }, { start: 3.2, end: 6 }, { start: 9, end: 30 }])
    ).toEqual([{ start: 6, end: 9 }]);
  });

  it("rejects non-positive durations", () => {
    expect(() => planVideoSampleWindows(0, [])).toThrow(RangeError);
    expect(() => planVideoSampleWindows(Number.NaN, [])).toThrow(RangeError);
  });
});

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";
const ffmpegInstalled = [FFMPEG, FFPROBE]
  .every((command) => spawnSync(command, ["-version"], { stdio: "pipe" }).status === 0);
function runFixtureFfmpeg(args: string[]): void {
  execFileSync(FFMPEG, args, { stdio: "pipe" });
}

describe("extendBlackThroughFades", () => {
  /** 10 fps frames from t=0 with the given luma sequence. */
  const frames = (lumas: number[]): FrameLuma[] => lumas.map((luma, index) => ({ time: index / 10, luma }));
  const BLACK = 16;

  it("extends a black run forward through a monotone fade-in and stops once the picture is bright", () => {
    const seq = [BLACK, BLACK, BLACK, 20, 30, 45, 60, 75, 95, 120, 120];
    expect(extendBlackThroughFades([{ start: 0, end: 0.3 }], frames(seq), 1.1)).toEqual([{ start: 0, end: 0.8 }]);
  });

  it("extends a trailing black run backward through a fade-out", () => {
    const seq = [120, 120, 100, 70, 50, 30, 18, BLACK, BLACK];
    expect(extendBlackThroughFades([{ start: 0.7, end: 0.9 }], frames(seq), 0.9)).toEqual([{ start: 0.3, end: 0.9 }]);
  });

  it("does not swallow a flat dark scene that borders black", () => {
    const seq = [BLACK, BLACK, 40, 40, 40, 40, 120];
    expect(extendBlackThroughFades([{ start: 0, end: 0.2 }], frames(seq), 0.7)).toEqual([{ start: 0, end: 0.2 }]);
  });

  it("stops at the first non-brightening frame", () => {
    const seq = [BLACK, 25, 35, 34, 50, 60];
    expect(extendBlackThroughFades([{ start: 0, end: 0.1 }], frames(seq), 0.6)).toEqual([{ start: 0, end: 0.3 }]);
  });

  it("leaves dark footage without a black neighbour untouched and keeps unrelated runs separate", () => {
    const seq = [40, 40, 40, BLACK, BLACK, 30, 50, 70, 90, 90, BLACK];
    expect(extendBlackThroughFades([{ start: 0.3, end: 0.5 }, { start: 1.0, end: 1.1 }], frames(seq), 1.1)).toEqual([
      { start: 0.3, end: 0.8 },
      { start: 1.0, end: 1.1 },
    ]);
    expect(extendBlackThroughFades([], frames(seq), 1.1)).toEqual([]);
  });

  it("passes black runs through when no luma samples are available", () => {
    expect(extendBlackThroughFades([{ start: 1, end: 2 }], [], 10)).toEqual([{ start: 1, end: 2 }]);
  });
});

describe.skipIf(!ffmpegInstalled)("preprocessVideoForEmbedding", () => {
  let dir: string;
  let longWithBlack: string;
  let shortClip: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "embed-video-"));
    longWithBlack = join(dir, "long.mp4");
    shortClip = join(dir, "short.mp4");
    // 3 s black leader, 2 s fade-in, 45 s content, 2 s black trailer, with an audio track.
    runFixtureFfmpeg([
      "-loglevel", "error",
      "-f", "lavfi", "-i", "color=c=black:size=320x240:rate=10:duration=3",
      "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=10:duration=50",
      "-f", "lavfi", "-i", "color=c=black:size=320x240:rate=10:duration=2",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=55",
      "-filter_complex", "[1:v]fade=t=in:st=0:d=2[c];[0:v][c][2:v]concat=n=3:v=1:a=0[v]",
      "-map", "[v]", "-map", "3:a",
      "-c:v", "libx264", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-shortest", "-y", longWithBlack,
    ]);
    runFixtureFfmpeg([
      "-loglevel", "error",
      "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=10:duration=12",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", shortClip,
    ]);
  }, 60000);

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  function probeSample(dataUrl: string) {
    const bytes = Buffer.from(dataUrl.slice("data:video/mp4;base64,".length), "base64");
    const result = spawnSync(
      FFPROBE,
      [
        "-v", "error",
        "-count_frames",
        "-show_entries", "stream=codec_type,nb_read_frames,width,height",
        "-of", "json",
        "-",
      ],
      { input: bytes, stdio: "pipe" }
    );
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`ffprobe exited with status ${result.status}: ${result.stderr.toString()}`);
    }
    const streams = JSON.parse(result.stdout.toString()).streams as Array<{
      codec_type: string;
      nb_read_frames?: string;
      width?: number;
      height?: number;
    }>;
    return {
      video: streams.find((stream) => stream.codec_type === "video"),
      hasAudio: streams.some((stream) => stream.codec_type === "audio"),
    };
  }

  it("cuts black leaders/fades and trailers, samples three windows, and strips audio", async () => {
    const processed = await preprocessVideoForEmbedding(longWithBlack);

    expect(processed.sampledRanges).toHaveLength(EMBEDDING_VIDEO_SAMPLE_WINDOW_COUNT);
    // Leader (0-3 s) and most of the fade-in are skipped; trailer (53-55 s) is skipped.
    expect(processed.sampledRanges[0].start).toBeGreaterThanOrEqual(3);
    expect(processed.sampledRanges[0].start).toBeLessThanOrEqual(5);
    expect(processed.sampledRanges[2].end).toBeLessThanOrEqual(53.1);
    const sampled = processed.sampledRanges.reduce((sum, range) => sum + (range.end - range.start), 0);
    expect(sampled).toBeCloseTo(SAMPLE_BUDGET_SECONDS, 5);

    const { video, hasAudio } = probeSample(processed.dataUrl);
    expect(hasAudio).toBe(false);
    // 2 fps over the 30 s budget; never more than the budget.
    expect(Number(video?.nb_read_frames)).toBe(2 * SAMPLE_BUDGET_SECONDS);
    expect(processed.processedWidth).toBe(320);
    expect(processed.processedHeight).toBe(240);
  }, 60000);

  it("downscales to 480p and keeps a short clip whole", async () => {
    const processed = await preprocessVideoForEmbedding(shortClip);

    expect(processed.sourceWidth).toBe(1920);
    expect(processed.sourceHeight).toBe(1080);
    expect(processed.processedWidth).toBe(480);
    expect(processed.processedHeight).toBe(270);
    expect(processed.sampledRanges).toEqual([{ start: 0, end: 12 }]);

    const { video } = probeSample(processed.dataUrl);
    expect(video?.width).toBe(480);
    expect(Number(video?.nb_read_frames)).toBe(24);
  }, 60000);

  it("keeps intentionally dark footage while still cutting true black and a fade-out", async () => {
    const darkClip = join(dir, "dark.mp4");
    // 2 s black leader, 8 s dark grey (~20% luma, flat), 6 s content fading out over
    // 13.5-15.5 s into 1 s of black. Timeline ends at 16.5 s.
    runFixtureFfmpeg([
      "-loglevel", "error",
      "-f", "lavfi", "-i", "color=c=black:size=320x240:rate=10:duration=2",
      "-f", "lavfi", "-i", "color=c=0x333333:size=320x240:rate=10:duration=8",
      "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=10:duration=6",
      "-f", "lavfi", "-i", "color=c=black:size=320x240:rate=10:duration=0.5",
      "-filter_complex", "[2:v]fade=t=out:st=3.5:d=2[c];[0:v][1:v][c][3:v]concat=n=4:v=1:a=0",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", darkClip,
    ]);

    const processed = await preprocessVideoForEmbedding(darkClip);

    expect(processed.sampledRanges).toHaveLength(1);
    const [range] = processed.sampledRanges;
    // Leader cut; the flat dark-grey scene is kept in full.
    expect(range.start).toBeGreaterThanOrEqual(1.9);
    expect(range.start).toBeLessThanOrEqual(2.2);
    // Trailing black plus the dark part of the fade-out are cut; the bright part of the fade survives.
    expect(range.end).toBeGreaterThan(13.5);
    expect(range.end).toBeLessThan(15.2);
  }, 60000);

  it.each([
    { name: "short black ending", duration: 3.8, black: "gte(t,3.7)" },
    { name: "black boundary between sample timestamps", duration: 9.3, black: "gte(t,6.1)" },
    { name: "single-frame black opening", duration: 3.8, black: "lt(t,0.03)" },
  ])("does not retain a $name in the encoded sample", async ({ duration, black }) => {
    const input = join(dir, `boundary-${duration}.mp4`);
    runFixtureFfmpeg([
      "-loglevel", "error",
      "-f", "lavfi", "-i", `color=c=gray:size=160x90:rate=30:duration=${duration}`,
      "-vf", `drawbox=color=black:t=fill:enable='${black}'`,
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", input,
    ]);

    const sample = await preprocessVideoForEmbedding(input);
    const luma = execFileSync(FFMPEG, [
      "-v", "error", "-i", "-", "-an",
      "-vf", "scale=1:1,format=gray", "-f", "rawvideo", "-",
    ], { input: Buffer.from(sample.dataUrl.split(",")[1], "base64") });
    expect(Math.max(...luma)).toBeGreaterThan(80);
    expect(Math.min(...luma)).toBeGreaterThan(16);
  });

  it("rejects files without a video stream", async () => {
    const audioOnly = join(dir, "audio.m4a");
    runFixtureFfmpeg([
      "-loglevel", "error",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
      "-c:a", "aac", "-y", audioOnly,
    ]);

    await expect(preprocessVideoForEmbedding(audioOnly)).rejects.toThrow("File has no video stream");
  }, 30000);
});
