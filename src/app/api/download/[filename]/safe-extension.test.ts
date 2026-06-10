import { describe, it, expect } from "vitest";
import { safeExtension } from "./route";

/**
 * Guard for ITEM 3: the DB-stored extension is interpolated into the
 * Content-Disposition response header. It must be a short, well-formed `.ext`
 * token or fall back to `.bin` to prevent header injection / malformed names.
 */
describe("safeExtension (Content-Disposition extension validator)", () => {
  it("accepts a normal extension", () => {
    expect(safeExtension(".jpg")).toBe(".jpg");
    expect(safeExtension(".png")).toBe(".png");
    expect(safeExtension(".webp")).toBe(".webp");
    expect(safeExtension(".mp4")).toBe(".mp4");
  });

  it("accepts underscores and digits", () => {
    expect(safeExtension(".bin")).toBe(".bin");
    expect(safeExtension(".mp3")).toBe(".mp3");
    expect(safeExtension(".tar_gz")).toBe(".tar_gz");
  });

  it("rejects CRLF header-injection payloads", () => {
    expect(safeExtension(".exe\r\nX:")).toBe(".bin");
    expect(safeExtension(".jpg\r\nSet-Cookie: x=1")).toBe(".bin");
  });

  it("rejects SQL/quote injection style values", () => {
    expect(safeExtension('"; drop')).toBe(".bin");
    expect(safeExtension('.jpg"')).toBe(".bin");
  });

  it("rejects values without a leading dot", () => {
    expect(safeExtension("jpg")).toBe(".bin");
    expect(safeExtension("png")).toBe(".bin");
  });

  it("rejects an overly long extension (> 10 chars after the dot)", () => {
    expect(safeExtension("." + "a".repeat(11))).toBe(".bin");
    expect(safeExtension(".aaaaaaaaaa")).toBe(".aaaaaaaaaa"); // exactly 10 -> allowed
  });

  it("rejects empty / dot-only input", () => {
    expect(safeExtension("")).toBe(".bin");
    expect(safeExtension(".")).toBe(".bin");
  });

  it("rejects null / undefined", () => {
    expect(safeExtension(null)).toBe(".bin");
    expect(safeExtension(undefined)).toBe(".bin");
  });

  it("rejects values with spaces, slashes, or extra dots", () => {
    expect(safeExtension(". jpg")).toBe(".bin");
    expect(safeExtension(".jp g")).toBe(".bin");
    expect(safeExtension(".jpg/../x")).toBe(".bin");
    expect(safeExtension(".tar.gz")).toBe(".bin");
  });
});
