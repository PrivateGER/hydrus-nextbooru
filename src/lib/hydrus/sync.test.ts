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
  TAG_CHUNK_SIZE,
  GROUP_CHUNK_SIZE,
} from "./sync";
import { TagCategory, SourceType } from "@/generated/prisma/client";

/**
 * Build a transaction stub whose `tx` simulates the database: every entry
 * referenced in a chunk's `findMany` OR-clause is "resolved" to a sequential id.
 * Also records, per INSERT, how many bind params were passed so tests can assert
 * the 65,535 limit is never breached.
 */
function makeTxStub() {
  let nextId = 1;
  const insertParamCounts: number[] = [];

  const tx = {
    $executeRawUnsafe: vi.fn(async (_sql: string, ...params: unknown[]) => {
      insertParamCounts.push(params.length);
      return params.length;
    }),
    tag: {
      findMany: vi.fn(async ({ where }: { where: { OR: Array<{ name: string; category: TagCategory }> } }) => {
        return where.OR.map((entry) => ({ id: nextId++, name: entry.name, category: entry.category }));
      }),
    },
    group: {
      findMany: vi.fn(async ({ where }: { where: { OR: Array<{ sourceType: SourceType; sourceId: string }> } }) => {
        return where.OR.map((entry) => ({ id: nextId++, sourceType: entry.sourceType, sourceId: entry.sourceId }));
      }),
    },
  };

  mockTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<void>) => {
    await fn(tx);
  });

  return { tx, insertParamCounts };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("bulkEnsureTags chunking (Item 1)", () => {
  it("resolves a tag set larger than TAG_CHUNK_SIZE without throwing", async () => {
    const { tx, insertParamCounts } = makeTxStub();

    // One more than a single chunk -> forces at least two chunks.
    const count = TAG_CHUNK_SIZE + 1000;
    const tags = new Map<string, { name: string; category: TagCategory }>();
    for (let i = 0; i < count; i++) {
      tags.set(`GENERAL:tag${i}`, { name: `tag${i}`, category: TagCategory.GENERAL });
    }

    const result = await bulkEnsureTags(tags);

    // Every tag must be resolved to an id.
    expect(result.size).toBe(count);
    for (let i = 0; i < count; i++) {
      expect(result.get(`GENERAL:tag${i.toString().toLowerCase()}`)).toBeTypeOf("number");
    }

    // Insert was split into multiple statements, none exceeding the bind limit.
    expect(insertParamCounts.length).toBeGreaterThanOrEqual(2);
    for (const c of insertParamCounts) {
      expect(c).toBeLessThanOrEqual(65535);
      expect(c).toBeLessThanOrEqual(TAG_CHUNK_SIZE * 2);
    }

    // findMany was chunked the same way (once per insert chunk).
    expect(tx.tag.findMany).toHaveBeenCalledTimes(insertParamCounts.length);
  });

  it("returns an empty map for an empty input without touching the DB", async () => {
    makeTxStub();
    const result = await bulkEnsureTags(new Map());
    expect(result.size).toBe(0);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("rejects invalid tag categories (adversarial input)", async () => {
    makeTxStub();
    const tags = new Map<string, { name: string; category: TagCategory }>([
      ["BOGUS:x", { name: "x", category: "BOGUS" as TagCategory }],
    ]);
    await expect(bulkEnsureTags(tags)).rejects.toThrow(/Invalid tag categories/);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

describe("bulkEnsureGroups chunking (Item 1)", () => {
  it("resolves a group set larger than GROUP_CHUNK_SIZE without throwing", async () => {
    const { tx, insertParamCounts } = makeTxStub();

    const count = GROUP_CHUNK_SIZE + 500;
    const groups = new Map<string, { sourceType: SourceType; sourceId: string; title?: string }>();
    for (let i = 0; i < count; i++) {
      groups.set(`PIXIV:${i}`, { sourceType: SourceType.PIXIV, sourceId: String(i) });
    }

    const result = await bulkEnsureGroups(groups);

    expect(result.size).toBe(count);

    // 3 params per group; chunks must stay within the bind limit.
    expect(insertParamCounts.length).toBeGreaterThanOrEqual(2);
    for (const c of insertParamCounts) {
      expect(c).toBeLessThanOrEqual(65535);
      expect(c).toBeLessThanOrEqual(GROUP_CHUNK_SIZE * 3);
    }
    expect(tx.group.findMany).toHaveBeenCalledTimes(insertParamCounts.length);
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
