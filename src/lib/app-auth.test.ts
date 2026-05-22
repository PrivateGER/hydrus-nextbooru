import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockNodeTimingSafeEqual = vi.hoisted(() =>
  vi.fn((a: Uint8Array, b: Uint8Array) => {
    if (a.byteLength !== b.byteLength) {
      throw new Error("length mismatch");
    }

    return Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;
  })
);

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    timingSafeEqual: mockNodeTimingSafeEqual,
  };
});

function createRequest(token: string): NextRequest {
  return new NextRequest("http://localhost/api/posts/example", {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
}

describe("app auth", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXTBOORU_READ_API_KEY: "sëcret-token",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("compares matching read API tokens with Node crypto over UTF-8 buffers", async () => {
    const { verifyReadApiAccess } = await import("@/lib/app-auth");

    const result = verifyReadApiAccess(createRequest("sëcret-token"));

    expect(result.authorized).toBe(true);
    expect(mockNodeTimingSafeEqual).toHaveBeenCalledTimes(1);
    const [actualToken, configuredToken] = mockNodeTimingSafeEqual.mock.calls[0];
    expect(Buffer.isBuffer(actualToken)).toBe(true);
    expect(Buffer.isBuffer(configuredToken)).toBe(true);
    expect(actualToken).toEqual(Buffer.from("sëcret-token", "utf8"));
    expect(configuredToken).toEqual(Buffer.from("sëcret-token", "utf8"));
  });

  it("rejects tokens with different UTF-8 byte lengths before comparing", async () => {
    process.env.NEXTBOORU_READ_API_KEY = "é";
    const { verifyReadApiAccess } = await import("@/lib/app-auth");

    const result = verifyReadApiAccess(createRequest("e"));

    expect(result.authorized).toBe(false);
    expect(mockNodeTimingSafeEqual).not.toHaveBeenCalled();
  });
});
