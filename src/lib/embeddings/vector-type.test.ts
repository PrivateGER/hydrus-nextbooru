import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { vectorType } from "@/lib/embeddings/store";

/**
 * Guard for ITEM 4: `dimensions` is interpolated into raw SQL (`vector(N)`) via
 * Prisma.raw, which performs no escaping. The construction site must reject any
 * value that is not a positive integer (defense-in-depth against a future
 * caller bypassing upstream validation).
 */
describe("vectorType (pgvector raw-SQL type guard)", () => {
  it("builds a Prisma.Sql fragment for a valid positive integer", () => {
    const sql = vectorType(512);
    expect(sql).toBeInstanceOf(Prisma.Sql);
    // Prisma.raw produces a literal fragment with no bound parameters.
    expect(sql.sql).toContain("vector(512)");
  });

  it("accepts common embedding dimensions", () => {
    expect(() => vectorType(768)).not.toThrow();
    expect(() => vectorType(1024)).not.toThrow();
    expect(() => vectorType(1536)).not.toThrow();
  });

  it("throws on non-integer (float) dimensions", () => {
    expect(() => vectorType(512.5)).toThrow(/Invalid embedding dimensions/);
  });

  it("throws on zero and negative dimensions", () => {
    expect(() => vectorType(0)).toThrow(/Invalid embedding dimensions/);
    expect(() => vectorType(-1)).toThrow(/Invalid embedding dimensions/);
  });

  it("throws on NaN / Infinity dimensions", () => {
    expect(() => vectorType(NaN)).toThrow(/Invalid embedding dimensions/);
    expect(() => vectorType(Infinity)).toThrow(/Invalid embedding dimensions/);
  });

  it("throws on a value coerced from an injection string", () => {
    // A future caller might pass an unparsed/NaN value; it must never reach SQL.
    expect(() => vectorType(Number("512); DROP TABLE"))).toThrow(/Invalid embedding dimensions/);
  });
});
