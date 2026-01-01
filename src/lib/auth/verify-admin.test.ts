import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextResponse } from "next/server";

// Mock next/headers before importing the module under test
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

// Mock the logger to avoid console output during tests
vi.mock("@/lib/logger", () => ({
  apiLog: {
    warn: vi.fn(),
    error: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  })),
}));

import { cookies } from "next/headers";
import { verifyAdminSession } from "./verify-admin";
import { createSession } from "./session";
import { SESSION_COOKIE_NAME } from "./types";

describe("verifyAdminSession", () => {
  const originalEnv = process.env;
  const mockCookies = cookies as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Password must be at least 16 characters
    process.env.ADMIN_PASSWORD = "test-admin-password-long-enough";
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return authorized for valid admin session", async () => {
    const token = await createSession("admin");

    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: token }),
    });

    const result = await verifyAdminSession();

    expect(result.authorized).toBe(true);
    expect(result.response).toBeUndefined();
  });

  it("should return 401 when no session cookie exists", async () => {
    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    });

    const result = await verifyAdminSession();

    expect(result.authorized).toBe(false);
    expect(result.response).toBeInstanceOf(NextResponse);
    expect(result.response?.status).toBe(401);
  });

  it("should return 401 for invalid session token", async () => {
    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "invalid-token" }),
    });

    const result = await verifyAdminSession();

    expect(result.authorized).toBe(false);
    expect(result.response?.status).toBe(401);
  });

  it("should return 401 for tampered session token", async () => {
    const token = await createSession("admin");
    const tamperedToken = token.slice(0, -5) + "xxxxx";

    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: tamperedToken }),
    });

    const result = await verifyAdminSession();

    expect(result.authorized).toBe(false);
    expect(result.response?.status).toBe(401);
  });

  it("should return 401 when cookies() throws an error", async () => {
    mockCookies.mockRejectedValue(new Error("Cookie access failed"));

    const result = await verifyAdminSession();

    expect(result.authorized).toBe(false);
    expect(result.response?.status).toBe(401);
  });

  it("should check for the correct cookie name", async () => {
    const token = await createSession("admin");
    const getMock = vi.fn().mockReturnValue({ value: token });

    mockCookies.mockResolvedValue({
      get: getMock,
    });

    await verifyAdminSession();

    expect(getMock).toHaveBeenCalledWith(SESSION_COOKIE_NAME);
  });

  it("should return 401 for empty cookie value", async () => {
    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "" }),
    });

    const result = await verifyAdminSession();

    expect(result.authorized).toBe(false);
    expect(result.response?.status).toBe(401);
  });

  it("should handle session verification throwing an error", async () => {
    // Unset the password to cause createSession to fail during verify
    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "some.token" }),
    });

    // Delete ADMIN_PASSWORD to cause getKey() to throw
    delete process.env.ADMIN_PASSWORD;

    const result = await verifyAdminSession();

    expect(result.authorized).toBe(false);
    expect(result.response?.status).toBe(401);
  });
});