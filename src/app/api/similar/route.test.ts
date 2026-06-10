import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockCheckApiRateLimit,
  mockComputePhashFromBuffer,
  mockQueryRaw,
  mockApiLogError,
} = vi.hoisted(() => ({
  mockCheckApiRateLimit: vi.fn(),
  mockComputePhashFromBuffer: vi.fn(),
  mockQueryRaw: vi.fn(),
  mockApiLogError: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: mockCheckApiRateLimit,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    phashEntry: { findUnique: vi.fn() },
    post: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/phash", () => ({
  computePhashFromBuffer: mockComputePhashFromBuffer,
  PHASH_SUPPORTED_MIMES: new Set(["image/png", "image/jpeg", "image/webp"]),
}));

vi.mock("@/lib/logger", () => ({
  apiLog: { error: mockApiLogError },
}));

function postRequest(form: FormData): NextRequest {
  return new NextRequest("http://localhost/api/similar", {
    method: "POST",
    body: form,
  });
}

function formWithFile(bytes: Uint8Array, type: string, name = "q.png"): FormData {
  const form = new FormData();
  form.append("file", new File([bytes], name, { type }));
  return form;
}

describe("POST /api/similar rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckApiRateLimit.mockReturnValue(null);
    mockComputePhashFromBuffer.mockResolvedValue(123n);
    mockQueryRaw.mockResolvedValue([]);
  });

  it("returns the 429 response and skips image decode when throttled", async () => {
    const limited = new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      { status: 429 }
    );
    mockCheckApiRateLimit.mockReturnValueOnce(limited);

    const { POST } = await import("./route");
    const response = await POST(postRequest(formWithFile(new Uint8Array([1, 2, 3]), "image/png")));

    expect(response.status).toBe(429);
    // The expensive sharp decode / phash computation must not run when rate limited.
    expect(mockComputePhashFromBuffer).not.toHaveBeenCalled();
  });

  it("processes the upload and returns 200 when under the limit", async () => {
    const { POST } = await import("./route");
    const response = await POST(postRequest(formWithFile(new Uint8Array([1, 2, 3]), "image/png")));
    const data = await response.json();

    expect(mockCheckApiRateLimit).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(mockComputePhashFromBuffer).toHaveBeenCalledTimes(1);
    expect(data.results).toEqual([]);
  });

  it("rejects an unsupported mime type with 415 without computing a phash", async () => {
    const { POST } = await import("./route");
    const response = await POST(postRequest(formWithFile(new Uint8Array([1]), "image/gif", "q.gif")));

    expect(response.status).toBe(415);
    expect(mockComputePhashFromBuffer).not.toHaveBeenCalled();
  });

  it("rejects an oversized upload with 413 (rate-limit is checked first but pass-through here)", async () => {
    const big = new Uint8Array(21 * 1024 * 1024);
    const { POST } = await import("./route");
    const response = await POST(postRequest(formWithFile(big, "image/png")));

    expect(response.status).toBe(413);
    expect(mockComputePhashFromBuffer).not.toHaveBeenCalled();
  });
});
