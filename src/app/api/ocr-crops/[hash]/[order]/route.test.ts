import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Readable } from "stream";

const { mockBuildCropFilePath, mockStat, mockCreateReadStream } = vi.hoisted(() => ({
  mockBuildCropFilePath: vi.fn(),
  mockStat: vi.fn(),
  mockCreateReadStream: vi.fn(),
}));

vi.mock("@/lib/ocr", () => ({
  buildCropFilePath: mockBuildCropFilePath,
}));

vi.mock("fs/promises", () => ({
  stat: mockStat,
}));

vi.mock("fs", () => ({
  createReadStream: mockCreateReadStream,
}));

import { GET } from "./route";

const HASH = "a".repeat(64);
const CROP_PATH = "/tmp/crops/ab/cd/aabb/0.webp";

const request = (order: string, query = "") =>
  new NextRequest(`http://localhost/api/ocr-crops/${HASH}/${order}${query}`);
const params = (hash: string, order: string) => ({
  params: Promise.resolve({ hash, order }),
});

beforeEach(() => {
  vi.clearAllMocks();
  mockBuildCropFilePath.mockReturnValue(CROP_PATH);
  mockStat.mockResolvedValue({ size: 123 });
  mockCreateReadStream.mockImplementation(() => Readable.from([Buffer.from("webp")]));
});

describe("GET /api/ocr-crops/[hash]/[order]", () => {
  it("400 on malformed hash and never touches the filesystem", async () => {
    const response = await GET(request("0"), params("nope", "0"));
    expect(response.status).toBe(400);
    expect(mockBuildCropFilePath).not.toHaveBeenCalled();
    expect(mockStat).not.toHaveBeenCalled();
  });

  it("400 on non-numeric order", async () => {
    const response = await GET(request("12a"), params(HASH, "12a"));
    expect(response.status).toBe(400);
    expect(mockBuildCropFilePath).not.toHaveBeenCalled();
  });

  it("400 on over-long order", async () => {
    const response = await GET(request("99999"), params(HASH, "99999"));
    expect(response.status).toBe(400);
    expect(mockBuildCropFilePath).not.toHaveBeenCalled();
  });

  it("404 when the crop file is missing", async () => {
    mockStat.mockRejectedValue(new Error("ENOENT"));
    const response = await GET(request("0"), params(HASH, "0"));
    expect(response.status).toBe(404);
    expect(mockCreateReadStream).not.toHaveBeenCalled();
  });

  it("200 streams the webp with immutable cache headers", async () => {
    const response = await GET(request("0"), params(HASH, "0"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(mockStat).toHaveBeenCalledWith(CROP_PATH);
    expect(mockCreateReadStream).toHaveBeenCalledWith(CROP_PATH);
    expect(await response.text()).toBe("webp");
  });

  it("builds the path from re-derived lowercased hash and integer order, ignoring the query string", async () => {
    const upper = "A".repeat(64);
    await GET(request("0007", "?v=99"), params(upper, "0007"));
    expect(mockBuildCropFilePath).toHaveBeenCalledWith(HASH, 7);
  });
});
