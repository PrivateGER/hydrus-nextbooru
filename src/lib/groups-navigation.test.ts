import { describe, expect, it } from "vitest";
import { buildGroupsSearchUrl, createGroupsSeed } from "./groups-navigation";

const seed = () => "deadbeef";

function parse(url: string) {
  const [path, qs] = url.split("?");
  return { path, params: new URLSearchParams(qs ?? "") };
}

describe("buildGroupsSearchUrl", () => {
  it("adds order=random and a seed when navigating from a seedless URL", () => {
    // Regression: a seedless random-order destination triggers a server-side
    // redirect that breaks client soft navigation, so the page never updates.
    const url = buildGroupsSearchUrl(new URLSearchParams(""), { query: "", creator: "tanaka" }, seed);
    const { path, params } = parse(url);
    expect(path).toBe("/groups");
    expect(params.get("creator")).toBe("tanaka");
    expect(params.get("order")).toBe("random");
    expect(params.get("seed")).toBe("deadbeef");
  });

  it("preserves an existing seed instead of generating a new one", () => {
    const current = new URLSearchParams("order=random&seed=abc123");
    const url = buildGroupsSearchUrl(current, { query: "", creator: "tanaka" }, seed);
    const { params } = parse(url);
    expect(params.get("seed")).toBe("abc123");
    expect(params.get("creator")).toBe("tanaka");
  });

  it("does not add a seed for non-random orders (those do not redirect)", () => {
    const current = new URLSearchParams("order=newest");
    const url = buildGroupsSearchUrl(current, { query: "", creator: "tanaka" }, seed);
    const { params } = parse(url);
    expect(params.get("order")).toBe("newest");
    expect(params.get("seed")).toBeNull();
  });

  it("applies the same seeding to the query (title) filter", () => {
    const url = buildGroupsSearchUrl(new URLSearchParams(""), { query: "spring", creator: "" }, seed);
    const { params } = parse(url);
    expect(params.get("q")).toBe("spring");
    expect(params.get("order")).toBe("random");
    expect(params.get("seed")).toBe("deadbeef");
  });

  it("clears filters and resets pagination while keeping a stable random view", () => {
    const current = new URLSearchParams("q=old&creator=someone&page=4&order=random&seed=keepme");
    const url = buildGroupsSearchUrl(current, { query: "", creator: "" }, seed);
    const { params } = parse(url);
    expect(params.get("q")).toBeNull();
    expect(params.get("creator")).toBeNull();
    expect(params.get("page")).toBeNull();
    expect(params.get("seed")).toBe("keepme");
  });

  it("trims whitespace-only filters to empty", () => {
    const url = buildGroupsSearchUrl(new URLSearchParams("order=newest"), { query: "   ", creator: "  " }, seed);
    const { params } = parse(url);
    expect(params.get("q")).toBeNull();
    expect(params.get("creator")).toBeNull();
  });

  it("accepts a ReadonlyURLSearchParams-like object (only needs toString)", () => {
    const readonlyLike = { toString: () => "order=random&seed=ro123" };
    const url = buildGroupsSearchUrl(readonlyLike, { query: "", creator: "x" }, seed);
    expect(parse(url).params.get("seed")).toBe("ro123");
  });

  it("createGroupsSeed produces 8 hex characters", () => {
    expect(createGroupsSeed()).toMatch(/^[0-9a-f]{8}$/);
  });
});
