import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockVerifyAdminSession,
  mockGetServices,
  mockSyncStateFindFirst,
  settingsStore,
} = vi.hoisted(() => ({
  mockVerifyAdminSession: vi.fn(),
  mockGetServices: vi.fn(),
  mockSyncStateFindFirst: vi.fn(),
  settingsStore: new Map<string, string>(),
}));

// In-memory Settings table: the route runs the real tag-services module, so
// normalization and the pendingResync rule are exercised end to end.
vi.mock("@/lib/db", () => {
  const settings = {
    findMany: vi.fn(async ({ where }: { where: { key: { in: string[] } } }) =>
      where.key.in
        .filter((key) => settingsStore.has(key))
        .map((key) => ({ key, value: settingsStore.get(key)! }))
    ),
    upsert: vi.fn(async ({ where, update }: { where: { key: string }; update: { value: string } }) => {
      settingsStore.set(where.key, update.value);
    }),
    deleteMany: vi.fn(async ({ where }: { where: { key: string } }) => {
      settingsStore.delete(where.key);
    }),
  };
  return {
    prisma: {
      settings,
      syncState: { findFirst: mockSyncStateFindFirst },
      $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    },
  };
});

vi.mock("@/lib/auth", () => ({
  verifyAdminSession: mockVerifyAdminSession,
}));

vi.mock("@/lib/logger", () => ({
  apiLog: { error: vi.fn(), warn: vi.fn() },
  syncLog: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/hydrus/client", () => ({
  getHydrusClient: () => ({ getServices: mockGetServices }),
}));

const MY_TAGS = "6c6f63616c2074616773";
const PTR = "aa".repeat(32);
const ALL_KNOWN = "616c6c206b6e6f776e2074616773";

const SERVICES = {
  [PTR]: { name: "public tag repository", type: 0, type_pretty: "hydrus tag repository" },
  "6c6f63616c2066696c6573": { name: "my files", type: 2, type_pretty: "local file domain" },
  [MY_TAGS]: { name: "my tags", type: 5, type_pretty: "local tag service" },
  [ALL_KNOWN]: { name: "all known tags", type: 10, type_pretty: "virtual combined tag service" },
};

// Handlers are typed `Promise<Response | undefined>` (the auth early-return),
// so narrow once here instead of at every call site.
async function loadRoute() {
  const route = await import("./route");
  return {
    GET: async () => (await route.GET())!,
    PUT: async (req: NextRequest) => (await route.PUT(req))!,
  };
}

function put(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/tag-services", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("admin tag-services route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsStore.clear();
    mockVerifyAdminSession.mockResolvedValue({ authorized: true });
    mockGetServices.mockResolvedValue({ version: 1, hydrus_version: 575, services: SERVICES });
    mockSyncStateFindFirst.mockResolvedValue({ status: "completed" });
  });

  it("returns 401 when not authorized", async () => {
    const unauthorized = new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    mockVerifyAdminSession.mockResolvedValue({ authorized: false, response: unauthorized });
    const { GET, PUT } = await loadRoute();

    expect((await GET()).status).toBe(401);
    mockVerifyAdminSession.mockResolvedValue({ authorized: false, response: unauthorized.clone() });
    expect((await PUT(put({ serviceKeys: null }))).status).toBe(401);
    expect(mockGetServices).not.toHaveBeenCalled();
  });

  it("GET lists tag services only, all known tags first, then local, then repositories", async () => {
    const { GET } = await loadRoute();
    const data = await (await GET()).json();

    expect(data.services.map((s: { serviceKey: string }) => s.serviceKey)).toEqual([ALL_KNOWN, MY_TAGS, PTR]);
    expect(data.services[1]).toEqual({ serviceKey: MY_TAGS, name: "my tags", type: 5, typePretty: "local tag service" });
    expect(data.selection).toEqual({ serviceKeys: null, includePending: false });
    expect(data.missingKeys).toEqual([]);
    // Unset selection and no fingerprint: nothing to apply
    expect(data.pendingResync).toBe(false);
    expect(data.hydrusError).toBeUndefined();
  });

  it("GET still returns the stored selection when Hydrus is down", async () => {
    settingsStore.set("hydrus.tagServiceKeys", JSON.stringify([MY_TAGS]));
    mockGetServices.mockRejectedValue(new Error("fetch failed"));
    const { GET } = await loadRoute();
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.services).toBeNull();
    expect(data.hydrusError).toContain("fetch failed");
    expect(data.selection.serviceKeys).toEqual([MY_TAGS]);
    expect(data.missingKeys).toEqual([]);
    expect(data.pendingResync).toBe(true);
  });

  it("GET reports selected keys Hydrus no longer has", async () => {
    const gone = "bb".repeat(32);
    settingsStore.set("hydrus.tagServiceKeys", JSON.stringify([MY_TAGS, gone]));
    const { GET } = await loadRoute();
    const data = await (await GET()).json();

    expect(data.missingKeys).toEqual([gone]);
  });

  it("PUT rejects malformed input with 400", async () => {
    const { PUT } = await loadRoute();

    for (const body of [
      { serviceKeys: "abc" },
      { serviceKeys: ["not-hex!"] },
      { serviceKeys: ["a".repeat(129)] },
      { serviceKeys: Array.from({ length: 65 }, (_, i) => i.toString(16).padStart(4, "0")) },
      { serviceKeys: null, includePending: "yes" },
    ]) {
      const response = await PUT(put(body));
      expect(response.status).toBe(400);
    }
    expect(settingsStore.size).toBe(0);
  });

  it("PUT rejects keys Hydrus does not know with 400", async () => {
    const { PUT } = await loadRoute();
    const response = await PUT(put({ serviceKeys: [MY_TAGS, "cc".repeat(32)] }));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("cc".repeat(32));
    expect(settingsStore.has("hydrus.tagServiceKeys")).toBe(false);
  });

  it("PUT rejects a file service key as unknown", async () => {
    const { PUT } = await loadRoute();
    const response = await PUT(put({ serviceKeys: ["6c6f63616c2066696c6573"] }));

    expect(response.status).toBe(400);
  });

  it("PUT returns 409 while a sync is running", async () => {
    mockSyncStateFindFirst.mockResolvedValue({ status: "running" });
    const { PUT } = await loadRoute();
    const response = await PUT(put({ serviceKeys: [MY_TAGS] }));

    expect(response.status).toBe(409);
    expect(settingsStore.size).toBe(0);
  });

  it("PUT saves a normalized selection and flags a pending resync", async () => {
    const { PUT } = await loadRoute();
    const response = await PUT(put({ serviceKeys: [PTR.toUpperCase(), MY_TAGS, MY_TAGS], includePending: true }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.selection).toEqual({ serviceKeys: [MY_TAGS, PTR].sort(), includePending: true });
    expect(data.pendingResync).toBe(true);
    expect(JSON.parse(settingsStore.get("hydrus.tagServiceKeys")!)).toEqual([MY_TAGS, PTR].sort());
    expect(settingsStore.get("hydrus.tagServices.includePending")).toBe("true");
  });

  it("PUT stores an empty list or one containing all known tags as unset", async () => {
    settingsStore.set("hydrus.tagServiceKeys", JSON.stringify([MY_TAGS]));
    const { PUT } = await loadRoute();

    let data = await (await PUT(put({ serviceKeys: [ALL_KNOWN, MY_TAGS] }))).json();
    expect(data.selection.serviceKeys).toBeNull();
    expect(settingsStore.has("hydrus.tagServiceKeys")).toBe(false);

    settingsStore.set("hydrus.tagServiceKeys", JSON.stringify([MY_TAGS]));
    data = await (await PUT(put({ serviceKeys: [] }))).json();
    expect(data.selection.serviceKeys).toBeNull();
    // Back to the default with no fingerprint: nothing pending
    expect(data.pendingResync).toBe(false);
  });

  it("PUT keeps includePending when omitted", async () => {
    settingsStore.set("hydrus.tagServices.includePending", "true");
    const { PUT } = await loadRoute();
    const data = await (await PUT(put({ serviceKeys: [MY_TAGS] }))).json();

    expect(data.selection.includePending).toBe(true);
  });

  it("PUT saves syntactically valid keys when Hydrus is unreachable", async () => {
    mockGetServices.mockRejectedValue(new Error("fetch failed"));
    const { PUT } = await loadRoute();
    const response = await PUT(put({ serviceKeys: [MY_TAGS] }));

    expect(response.status).toBe(200);
    expect(JSON.parse(settingsStore.get("hydrus.tagServiceKeys")!)).toEqual([MY_TAGS]);
  });

  it("pendingResync clears once the applied fingerprint matches", async () => {
    const { PUT, GET } = await loadRoute();
    await PUT(put({ serviceKeys: [MY_TAGS] }));

    const { selectionFingerprint } = await import("@/lib/hydrus/tag-services");
    settingsStore.set(
      "hydrus.tagServices.appliedFingerprint",
      selectionFingerprint({ serviceKeys: [MY_TAGS], includePending: false })
    );
    expect((await (await GET()).json()).pendingResync).toBe(false);

    // Reverting to the default after applying a selection needs a resync too
    await PUT(put({ serviceKeys: null }));
    expect((await (await GET()).json()).pendingResync).toBe(true);
  });
});
