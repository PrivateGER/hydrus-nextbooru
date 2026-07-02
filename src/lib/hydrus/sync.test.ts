import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mock @/lib/db before importing the module under test -----------------
const {
  mockTransaction,
  mockSyncStateUpdateMany,
  mockSyncStateFindFirst,
  mockSyncStateCreate,
} = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockSyncStateUpdateMany: vi.fn(),
  mockSyncStateFindFirst: vi.fn(),
  mockSyncStateCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mockTransaction,
    syncState: {
      updateMany: mockSyncStateUpdateMany,
      findFirst: mockSyncStateFindFirst,
      create: mockSyncStateCreate,
    },
  },
}));

import {
  bulkEnsureTags,
  bulkEnsureGroups,
  acquireSyncLock,
} from "./sync";
import { TagCategory, SourceType } from "@/generated/prisma/client";

/**
 * Build a transaction stub whose `tx` simulates the database for the
 * unnest-based bulk ensures: the INSERT ($executeRaw) records its bind
 * params, and the resolving SELECT ($queryRaw) "returns" one row per entry
 * of the bound arrays with a sequential id. `rowsFromParams` maps the
 * SELECT's bind arrays to result rows (tags and groups differ in shape).
 */
function makeTxStub(rowsFromParams: (params: unknown[], nextId: () => number) => unknown[]) {
  let id = 0;
  const nextId = () => ++id;
  const insertBindParams: unknown[][] = [];

  const tx = {
    $executeRaw: vi.fn(async (_strings: TemplateStringsArray, ...params: unknown[]) => {
      insertBindParams.push(params);
      return 0;
    }),
    $queryRaw: vi.fn(async (_strings: TemplateStringsArray, ...params: unknown[]) => {
      return rowsFromParams(params, nextId);
    }),
  };

  mockTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<void>) => {
    await fn(tx);
  });

  return { tx, insertBindParams };
}

function makeTagTxStub() {
  return makeTxStub((params, nextId) => {
    const [names, categories] = params as [string[], string[]];
    return names.map((name, i) => ({ id: nextId(), name, category: categories[i] }));
  });
}

function makeGroupTxStub() {
  return makeTxStub((params, nextId) => {
    const [sourceTypes, sourceIds] = params as [string[], string[]];
    return sourceTypes.map((sourceType, i) => ({ id: nextId(), sourceType, sourceId: sourceIds[i] }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("bulkEnsureTags array binding", () => {
  it("resolves a large tag set with one INSERT and one SELECT, binding arrays instead of per-row params", async () => {
    const { tx, insertBindParams } = makeTagTxStub();

    // Well past the old 15,000-per-chunk limit: with array binds there is no
    // chunking, so the statement count must stay constant.
    const count = 20_000;
    const tags = new Map<string, { name: string; category: TagCategory }>();
    for (let i = 0; i < count; i++) {
      tags.set(`GENERAL:tag${i}`, { name: `tag${i}`, category: TagCategory.GENERAL });
    }

    const result = await bulkEnsureTags(tags);

    // Every tag must be resolved to an id.
    expect(result.size).toBe(count);
    for (let i = 0; i < count; i++) {
      expect(result.get(`GENERAL:tag${i}`)).toBeTypeOf("number");
    }

    // Exactly one INSERT and one SELECT regardless of input size.
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);

    // The INSERT binds two parallel arrays (names, categories) - a constant
    // bind count of 2, not 2 * count.
    expect(insertBindParams[0]).toHaveLength(2);
    const [names, categories] = insertBindParams[0] as [string[], string[]];
    expect(names).toHaveLength(count);
    expect(categories).toHaveLength(count);
  });

  it("keys resolved ids by lowercased tag name", async () => {
    makeTagTxStub();

    const tags = new Map<string, { name: string; category: TagCategory }>([
      ["ARTIST:mixedcase", { name: "MixedCase", category: TagCategory.ARTIST }],
    ]);

    const result = await bulkEnsureTags(tags);

    expect(result.get("ARTIST:mixedcase")).toBeTypeOf("number");
    expect(result.has("ARTIST:MixedCase")).toBe(false);
  });

  it("returns an empty map for an empty input without touching the DB", async () => {
    makeTagTxStub();
    const result = await bulkEnsureTags(new Map());
    expect(result.size).toBe(0);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("rejects invalid tag categories (adversarial input)", async () => {
    makeTagTxStub();
    const tags = new Map<string, { name: string; category: TagCategory }>([
      ["BOGUS:x", { name: "x", category: "BOGUS" as TagCategory }],
    ]);
    await expect(bulkEnsureTags(tags)).rejects.toThrow(/Invalid tag categories/);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

describe("bulkEnsureGroups array binding", () => {
  it("resolves a large group set with one INSERT and one SELECT, binding arrays instead of per-row params", async () => {
    const { tx, insertBindParams } = makeGroupTxStub();

    // Well past the old 10,000-per-chunk limit.
    const count = 12_000;
    const groups = new Map<string, { sourceType: SourceType; sourceId: string; title?: string }>();
    for (let i = 0; i < count; i++) {
      groups.set(`PIXIV:${i}`, { sourceType: SourceType.PIXIV, sourceId: String(i) });
    }

    const result = await bulkEnsureGroups(groups);

    expect(result.size).toBe(count);
    for (let i = 0; i < count; i++) {
      expect(result.get(`PIXIV:${i}`)).toBeTypeOf("number");
    }

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);

    // The INSERT binds three parallel arrays (sourceTypes, sourceIds, titles).
    expect(insertBindParams[0]).toHaveLength(3);
    const [sourceTypes, sourceIds, titles] = insertBindParams[0] as [string[], string[], (string | null)[]];
    expect(sourceTypes).toHaveLength(count);
    expect(sourceIds).toHaveLength(count);
    expect(titles).toHaveLength(count);
  });

  it("binds missing titles as null so existing titles are preserved via COALESCE", async () => {
    const { insertBindParams } = makeGroupTxStub();

    const groups = new Map<string, { sourceType: SourceType; sourceId: string; title?: string }>([
      ["PIXIV:1", { sourceType: SourceType.PIXIV, sourceId: "1" }],
      ["TITLE:abc", { sourceType: SourceType.TITLE, sourceId: "abc", title: "My Title" }],
    ]);

    await bulkEnsureGroups(groups);

    const [, , titles] = insertBindParams[0] as [string[], string[], (string | null)[]];
    expect(titles).toEqual([null, "My Title"]);
  });

  it("rejects invalid source types (adversarial input)", async () => {
    makeGroupTxStub();
    const groups = new Map<string, { sourceType: SourceType; sourceId: string; title?: string }>([
      ["BOGUS:1", { sourceType: "BOGUS" as SourceType, sourceId: "1" }],
    ]);
    await expect(bulkEnsureGroups(groups)).rejects.toThrow(/Invalid source types/);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

describe("acquireSyncLock atomicity (Item 4)", () => {
  it("acquires when the conditional update claims an existing non-running row", async () => {
    mockSyncStateUpdateMany.mockResolvedValueOnce({ count: 1 });

    const acquired = await acquireSyncLock();

    expect(acquired).toBe(true);
    // Winner decided by the DB write; no findFirst/create fallback needed.
    expect(mockSyncStateUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockSyncStateUpdateMany.mock.calls[0][0].where).toEqual({ status: { not: "running" } });
    expect(mockSyncStateFindFirst).not.toHaveBeenCalled();
  });

  it("returns false when a sync is already running (update claims nothing, row exists)", async () => {
    mockSyncStateUpdateMany.mockResolvedValueOnce({ count: 0 });
    mockSyncStateFindFirst.mockResolvedValueOnce({ status: "running" });

    const acquired = await acquireSyncLock();

    expect(acquired).toBe(false);
    expect(mockSyncStateCreate).not.toHaveBeenCalled();
  });

  it("creates the row and acquires when none exists yet", async () => {
    mockSyncStateUpdateMany.mockResolvedValueOnce({ count: 0 });
    mockSyncStateFindFirst.mockResolvedValueOnce(null);
    mockSyncStateCreate.mockResolvedValueOnce({ id: 1, status: "running" });

    const acquired = await acquireSyncLock();

    expect(acquired).toBe(true);
    expect(mockSyncStateCreate).toHaveBeenCalledTimes(1);
  });

  it("loses the create race and re-attempts the atomic claim (concurrent start)", async () => {
    // First update: nothing to claim. Row absent at findFirst time.
    mockSyncStateUpdateMany
      .mockResolvedValueOnce({ count: 0 }) // initial claim
      .mockResolvedValueOnce({ count: 0 }); // retry after failed create -> someone else holds it
    mockSyncStateFindFirst.mockResolvedValueOnce(null);
    // A concurrent caller created the row first -> our create throws (unique race).
    mockSyncStateCreate.mockRejectedValueOnce(new Error("unique constraint"));

    const acquired = await acquireSyncLock();

    // The other caller won; we correctly report not acquired.
    expect(acquired).toBe(false);
    expect(mockSyncStateUpdateMany).toHaveBeenCalledTimes(2);
  });

  it("wins the retry claim if the racing row is not running", async () => {
    mockSyncStateUpdateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 }); // retry succeeds
    mockSyncStateFindFirst.mockResolvedValueOnce(null);
    mockSyncStateCreate.mockRejectedValueOnce(new Error("unique constraint"));

    const acquired = await acquireSyncLock();

    expect(acquired).toBe(true);
  });
});
