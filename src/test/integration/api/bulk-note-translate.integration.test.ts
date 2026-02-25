import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { setupServer, type SetupServer } from "msw/node";
import { setupTestDatabase, teardownTestDatabase, getTestPrisma, cleanDatabase } from "../setup";
import { createPost } from "../factories";
import { setTestPrisma } from "@/lib/db";
import { SETTINGS_KEYS } from "@/lib/openrouter/types";
import { resetNoteTranslationProgress } from "@/app/api/admin/note-translations/route";
import {
  createOpenRouterHandlers,
  createMockOpenRouterState,
  setTranslationResponse,
  type MockOpenRouterState,
} from "@/test/mocks/openrouter-server";

vi.mock("@/lib/auth", () => ({
  verifyAdminSession: vi.fn().mockResolvedValue({ authorized: true }),
}));

async function waitForTranslationComplete(
  maxWaitMs = 5000,
  pollIntervalMs = 50
): Promise<{ status: string; [key: string]: unknown }> {
  const { GET } = await import("@/app/api/admin/note-translations/route");
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const response = await GET();
    const data = await response.json();

    if (data.status !== "running") {
      return data;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Translation did not complete within ${maxWaitMs}ms`);
}

describe("Bulk Note Translation API", () => {
  let server: SetupServer;
  let openRouterState: MockOpenRouterState;

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
    resetNoteTranslationProgress();

    openRouterState = createMockOpenRouterState();
    server = setupServer(...createOpenRouterHandlers(openRouterState));
    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server.close();
  });

  it("returns idle progress when not running", async () => {
    const { GET } = await import("@/app/api/admin/note-translations/route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("idle");
  });

  it("starts bulk note translation and deduplicates by content hash", async () => {
    const prisma = getTestPrisma();

    await prisma.settings.upsert({
      where: { key: SETTINGS_KEYS.API_KEY },
      update: { value: "test-api-key" },
      create: { key: SETTINGS_KEYS.API_KEY, value: "test-api-key" },
    });

    const postA = await createPost(prisma, { hash: "a".repeat(64), hydrusFileId: 1 });
    const postB = await createPost(prisma, { hash: "b".repeat(64), hydrusFileId: 2 });
    const postC = await createPost(prisma, { hash: "c".repeat(64), hydrusFileId: 3 });

    await prisma.note.create({
      data: { postId: postA.id, name: "A", content: "共有ノート" },
    });
    await prisma.note.create({
      data: { postId: postB.id, name: "B", content: "共有ノート" },
    });
    await prisma.note.create({
      data: { postId: postC.id, name: "C", content: "別の内容" },
    });

    setTranslationResponse(openRouterState, "Translated", "Japanese");

    const { POST } = await import("@/app/api/admin/note-translations/route");
    const response = await POST(
      new NextRequest("http://localhost/api/admin/note-translations", {
        method: "POST",
      })
    );

    expect(response.status).toBe(200);

    const status = await waitForTranslationComplete();
    expect(status.status).toBe("completed");
    expect(status.total).toBe(2);
    expect(status.completed).toBe(2);
    expect(status.failed).toBe(0);

    expect(openRouterState.callCount).toBe(2);

    const translations = await prisma.contentTranslation.findMany();
    expect(translations).toHaveLength(2);
  });

  it("returns 400 on cancel when no note translation is running", async () => {
    const { DELETE } = await import("@/app/api/admin/note-translations/route");
    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("No translation in progress");
  });

  it("estimates unique untranslated notes", async () => {
    const prisma = getTestPrisma();

    await prisma.settings.upsert({
      where: { key: SETTINGS_KEYS.API_KEY },
      update: { value: "test-api-key" },
      create: { key: SETTINGS_KEYS.API_KEY, value: "test-api-key" },
    });

    const postA = await createPost(prisma, { hash: "d".repeat(64), hydrusFileId: 4 });
    const postB = await createPost(prisma, { hash: "e".repeat(64), hydrusFileId: 5 });
    const postC = await createPost(prisma, { hash: "f".repeat(64), hydrusFileId: 6 });

    const translatedNote = await prisma.note.create({
      data: { postId: postA.id, name: "A", content: "Translated Content" },
    });
    await prisma.note.create({
      data: { postId: postB.id, name: "B", content: "Translated Content" },
    });
    await prisma.note.create({
      data: { postId: postC.id, name: "C", content: "Pending Content" },
    });

    await prisma.contentTranslation.create({
      data: {
        contentHash: translatedNote.contentHash,
        translatedContent: "Already translated",
        sourceLanguage: "ja",
        targetLanguage: "en",
      },
    });

    const { GET } = await import("@/app/api/admin/note-translations/estimate/route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalUniqueNotes).toBe(2);
    expect(data.translatedCount).toBe(1);
    expect(data.untranslatedCount).toBe(1);
  });
});
