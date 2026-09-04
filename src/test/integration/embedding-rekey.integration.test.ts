import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from "./setup";
import { setTestPrisma } from "@/lib/db";
import { createPost } from "./factories";
import {
  rekeyVideoEmbeddings,
  upsertCompleteEmbedding,
  upsertFailedEmbedding,
} from "@/lib/embeddings/store";

const dimensions = 768;
const base = {
  baseUrl: "https://openrouter.ai/api/v1",
  model: "google/gemini-embedding-2-preview",
  dimensions,
  videoEnabled: true,
};
const at1024 = { ...base, imageMaxResolution: 1024 };
const at2048 = { ...base, imageMaxResolution: 2048 };

function vector(axis: number): number[] {
  const values = Array.from({ length: dimensions }, () => 0);
  values[axis] = 1;
  return values;
}

async function complete(postId: number, config: typeof at1024, axis: number) {
  await upsertCompleteEmbedding({
    postId,
    config,
    embedding: vector(axis),
    sourceWidth: 100,
    sourceHeight: 100,
    processedWidth: 100,
    processedHeight: 100,
  });
}

async function failed(postId: number, config: typeof at1024) {
  await upsertFailedEmbedding({ postId, config, errorMessage: "boom" });
}

async function rowsFor(postId: number) {
  return getTestPrisma().postEmbedding.findMany({
    where: { postId },
    select: { imageMaxResolution: true, status: true },
    orderBy: { imageMaxResolution: "asc" },
  });
}

describe("rekeyVideoEmbeddings (integration)", () => {
  beforeAll(async () => {
    const { prisma } = await setupTestDatabase();
    setTestPrisma(prisma);
  });

  afterAll(async () => {
    setTestPrisma(null);
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  it("moves video rows to the new resolution, keeps COMPLETE over FAILED on conflict, and leaves images alone", async () => {
    const prisma = getTestPrisma();
    const plain = await createPost(prisma, { mimeType: "video/mp4", extension: ".mp4" });
    const failedSourceVsCompleteTarget = await createPost(prisma, { mimeType: "video/mp4", extension: ".mp4" });
    const completeSourceVsFailedTarget = await createPost(prisma, { mimeType: "video/webm", extension: ".webm" });
    const bothComplete = await createPost(prisma, { mimeType: "video/mp4", extension: ".mp4" });
    const image = await createPost(prisma, { mimeType: "image/png", extension: ".png" });

    await complete(plain.id, at1024, 0);
    await failed(failedSourceVsCompleteTarget.id, at1024);
    await complete(failedSourceVsCompleteTarget.id, at2048, 1);
    await complete(completeSourceVsFailedTarget.id, at1024, 2);
    await failed(completeSourceVsFailedTarget.id, at2048);
    await complete(bothComplete.id, at1024, 3);
    await complete(bothComplete.id, at2048, 4);
    await complete(image.id, at1024, 5);

    const moved = await rekeyVideoEmbeddings(at1024, 2048);

    // plain + completeSourceVsFailedTarget moved; the two other sources were dropped.
    expect(moved).toBe(2);
    expect(await rowsFor(plain.id)).toEqual([{ imageMaxResolution: 2048, status: "COMPLETE" }]);
    expect(await rowsFor(failedSourceVsCompleteTarget.id)).toEqual([{ imageMaxResolution: 2048, status: "COMPLETE" }]);
    expect(await rowsFor(completeSourceVsFailedTarget.id)).toEqual([{ imageMaxResolution: 2048, status: "COMPLETE" }]);
    expect(await rowsFor(bothComplete.id)).toEqual([{ imageMaxResolution: 2048, status: "COMPLETE" }]);
    expect(await rowsFor(image.id)).toEqual([{ imageMaxResolution: 1024, status: "COMPLETE" }]);

    // Which vector survived for bothComplete: the pre-existing target (axis 4).
    const [{ embedding }] = await prisma.$queryRaw<{ embedding: string }[]>`
      SELECT embedding::text AS embedding FROM "PostEmbedding" WHERE "postId" = ${bothComplete.id}
    `;
    expect(JSON.parse(embedding)[4]).toBe(1);

    // Same-key call is a no-op.
    expect(await rekeyVideoEmbeddings(at2048, 2048)).toBe(0);
  });
});
