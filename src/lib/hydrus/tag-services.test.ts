import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindMany } = vi.hoisted(() => ({ mockFindMany: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: { settings: { findMany: mockFindMany } },
}));

import {
  ALL_TAG_SERVICES_FILTER,
  collectDisplayTags,
  filterTagServices,
  getTagServiceSelection,
  isResyncPending,
  normalizeSelectionKeys,
  resolveSelection,
  selectionFingerprint,
  type TagServiceInfo,
} from "./tag-services";
import { extractTags } from "./sync";
import { createMockFileMetadata, createMockFileWithServiceTags } from "@/test/mocks/fixtures/hydrus-metadata";
import type { HydrusFileMetadata } from "./types";

const MY_TAGS = "6c6f63616c2074616773";
const PTR = "aa".repeat(32);
const ALL_KNOWN = "616c6c206b6e6f776e2074616773";

const AVAILABLE: TagServiceInfo[] = [
  { serviceKey: ALL_KNOWN, name: "all known tags", type: 10, typePretty: "virtual combined tag service" },
  { serviceKey: MY_TAGS, name: "my tags", type: 5, typePretty: "local tag service" },
  { serviceKey: PTR, name: "public tag repository", type: 0, typePretty: "hydrus tag repository" },
];

function splitFile() {
  return createMockFileWithServiceTags({
    [MY_TAGS]: { "0": ["mine", "shared"], "1": ["mine pending"] },
    [PTR]: { "0": ["ptr only", "shared"], "1": ["ptr pending"] },
  });
}

describe("collectDisplayTags", () => {
  it("unions every service (all known tags included) without a filter", () => {
    const tags = collectDisplayTags(splitFile(), ALL_TAG_SERVICES_FILTER);
    expect(new Set(tags)).toEqual(new Set(["mine", "shared", "ptr only"]));
  });

  it("reads only the allowed services", () => {
    const tags = collectDisplayTags(splitFile(), { allowed: new Set([MY_TAGS]), includePending: false });
    expect(tags).toEqual(["mine", "shared"]);
  });

  it("matches service keys case-insensitively", () => {
    const file = createMockFileWithServiceTags({ [MY_TAGS.toUpperCase()]: ["upper"] }, { includeAllKnownTags: false });
    expect(collectDisplayTags(file, { allowed: new Set([MY_TAGS]), includePending: false })).toEqual(["upper"]);
  });

  it("adds pending tags only when asked", () => {
    const filter = { allowed: new Set([PTR]), includePending: true };
    expect(collectDisplayTags(splitFile(), filter)).toEqual(["ptr only", "shared", "ptr pending"]);
    expect(collectDisplayTags(splitFile(), { ...filter, includePending: false })).toEqual(["ptr only", "shared"]);
  });

  it("skips malformed entries without throwing", () => {
    const file = createMockFileMetadata({
      tags: {
        [MY_TAGS]: { storage_tags: {}, display_tags: { "0": ["ok", "", null as unknown as string, 5 as unknown as string] } },
        bad1: null as unknown as HydrusFileMetadata["tags"][string],
        bad2: { storage_tags: {}, display_tags: null as unknown as Record<string, string[]> },
        bad3: { storage_tags: {}, display_tags: { "0": "nope" as unknown as string[] } },
      },
    });
    expect(collectDisplayTags(file, ALL_TAG_SERVICES_FILTER)).toEqual(["ok"]);
    expect(collectDisplayTags(createMockFileMetadata({ tags: undefined as unknown as HydrusFileMetadata["tags"] }), ALL_TAG_SERVICES_FILTER)).toEqual([]);
  });
});

describe("extractTags", () => {
  it("keeps the legacy behaviour by default (fixtures keyed by 'all known tags')", () => {
    const file = createMockFileMetadata();
    expect(extractTags(file).map((t) => t.name)).toEqual(["tag1", "test artist"]);
  });

  it("filters to the selected service and dedupes", () => {
    const tags = extractTags(splitFile(), { allowed: new Set([MY_TAGS]), includePending: false });
    expect(tags.map((t) => t.name)).toEqual(["mine", "shared"]);
  });

  it("skips system tags", () => {
    const file = createMockFileWithServiceTags({ [MY_TAGS]: ["system:inbox", "real"] });
    expect(extractTags(file).map((t) => t.name)).toEqual(["real"]);
  });
});

describe("resolveSelection", () => {
  it("returns null (everything) for an unset selection", () => {
    expect(resolveSelection({ serviceKeys: null, includePending: false }, AVAILABLE)).toEqual({ allowed: null, missing: [] });
  });

  it("resolves specific services", () => {
    const { allowed, missing } = resolveSelection({ serviceKeys: [MY_TAGS], includePending: false }, AVAILABLE);
    expect(allowed).toEqual(new Set([MY_TAGS]));
    expect(missing).toEqual([]);
  });

  it("treats all known tags as exclusive and equivalent to everything", () => {
    const { allowed } = resolveSelection({ serviceKeys: [MY_TAGS, ALL_KNOWN], includePending: false }, AVAILABLE);
    expect(allowed).toBeNull();
  });

  it("reports selected keys that Hydrus no longer has", () => {
    const gone = "bb".repeat(32);
    const { missing } = resolveSelection({ serviceKeys: [MY_TAGS, gone], includePending: false }, AVAILABLE);
    expect(missing).toEqual([gone]);
  });
});

describe("filterTagServices", () => {
  it("keeps tag services only, sorted all known, local, repositories", () => {
    const services = filterTagServices({
      [PTR]: { name: "ptr", type: 0, type_pretty: "hydrus tag repository" },
      ff: { name: "my files", type: 2, type_pretty: "local file domain" },
      [MY_TAGS]: { name: "my tags", type: 5, type_pretty: "local tag service" },
      [ALL_KNOWN]: { name: "all known tags", type: 10, type_pretty: "virtual combined tag service" },
    });
    expect(services.map((s) => s.serviceKey)).toEqual([ALL_KNOWN, MY_TAGS, PTR]);
  });
});

describe("normalizeSelectionKeys", () => {
  it("collapses empty or all-known-tags selections to unset", () => {
    expect(normalizeSelectionKeys([], AVAILABLE)).toBeNull();
    expect(normalizeSelectionKeys([ALL_KNOWN], AVAILABLE)).toBeNull();
    expect(normalizeSelectionKeys([PTR, MY_TAGS, MY_TAGS.toUpperCase()], AVAILABLE)).toEqual([MY_TAGS, PTR].sort());
  });
});

describe("selectionFingerprint / isResyncPending", () => {
  it("is order- and case-independent", () => {
    const a = selectionFingerprint({ serviceKeys: [MY_TAGS, PTR], includePending: false });
    const b = selectionFingerprint({ serviceKeys: [PTR.toUpperCase(), MY_TAGS], includePending: false });
    expect(a).toBe(b);
    expect(a).not.toBe(selectionFingerprint({ serviceKeys: [MY_TAGS, PTR], includePending: true }));
    expect(selectionFingerprint({ serviceKeys: [], includePending: false }))
      .toBe(selectionFingerprint({ serviceKeys: null, includePending: false }));
  });

  it("does not flag the default selection on an install with no fingerprint", () => {
    expect(isResyncPending({ serviceKeys: null, includePending: false }, null)).toBe(false);
    expect(isResyncPending({ serviceKeys: [MY_TAGS], includePending: false }, null)).toBe(true);
    expect(isResyncPending({ serviceKeys: null, includePending: true }, null)).toBe(true);
    const applied = selectionFingerprint({ serviceKeys: [MY_TAGS], includePending: false });
    expect(isResyncPending({ serviceKeys: [MY_TAGS], includePending: false }, applied)).toBe(false);
    expect(isResyncPending({ serviceKeys: null, includePending: false }, applied)).toBe(true);
  });
});

describe("getTagServiceSelection", () => {
  beforeEach(() => mockFindMany.mockReset());

  it("reads all keys with a single query", async () => {
    mockFindMany.mockResolvedValue([
      { key: "hydrus.tagServiceKeys", value: JSON.stringify([PTR, MY_TAGS.toUpperCase()]) },
      { key: "hydrus.tagServices.includePending", value: "true" },
    ]);
    expect(await getTagServiceSelection()).toEqual({ serviceKeys: [MY_TAGS, PTR].sort(), includePending: true });
    expect(mockFindMany).toHaveBeenCalledTimes(1);
  });

  it("falls back to all services on bad JSON or a non-array", async () => {
    for (const value of ["{not json", JSON.stringify({ a: 1 }), JSON.stringify([]), JSON.stringify(["zz-not-hex", 42])]) {
      mockFindMany.mockResolvedValue([{ key: "hydrus.tagServiceKeys", value }]);
      expect(await getTagServiceSelection()).toEqual({ serviceKeys: null, includePending: false });
    }
  });

  it("drops invalid entries but keeps valid ones", async () => {
    mockFindMany.mockResolvedValue([{ key: "hydrus.tagServiceKeys", value: JSON.stringify([MY_TAGS, "nope!", null]) }]);
    expect((await getTagServiceSelection()).serviceKeys).toEqual([MY_TAGS]);
  });
});
