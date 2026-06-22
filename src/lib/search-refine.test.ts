import { describe, it, expect } from "vitest";
import { buildRefinedSearchUrl } from "./search-refine";

function tagsParamOf(url: string): string | null {
  return new URL(url, "http://localhost").searchParams.get("tags");
}

describe("buildRefinedSearchUrl", () => {
  it("appends the tag to the current query", () => {
    const url = buildRefinedSearchUrl(["blue archive"], "solo");
    expect(tagsParamOf(url)).toBe("blue archive,solo");
  });

  it("appends a negated tag when excluding", () => {
    const url = buildRefinedSearchUrl(["blue archive"], "solo", { negate: true });
    expect(tagsParamOf(url)).toBe("blue archive,-solo");
  });

  it("does not duplicate a tag that is already in the query", () => {
    const url = buildRefinedSearchUrl(["blue archive", "solo"], "solo");
    expect(tagsParamOf(url)).toBe("blue archive,solo");
  });

  it("flips an excluded tag to included when adding it", () => {
    const url = buildRefinedSearchUrl(["blue archive", "-solo"], "solo");
    expect(tagsParamOf(url)).toBe("blue archive,solo");
  });

  it("flips an included tag to excluded when negating it", () => {
    const url = buildRefinedSearchUrl(["blue archive", "solo"], "solo", { negate: true });
    expect(tagsParamOf(url)).toBe("blue archive,-solo");
  });

  it("matches existing tags case-insensitively", () => {
    const url = buildRefinedSearchUrl(["Blue Archive"], "blue archive");
    expect(tagsParamOf(url)).toBe("blue archive");
  });

  it("URL-encodes special characters safely", () => {
    const url = buildRefinedSearchUrl(["a&b"], "c d?");
    expect(tagsParamOf(url)).toBe("a&b,c d?");
  });

  it("starts a fresh query when there are no current tags", () => {
    const url = buildRefinedSearchUrl([], "solo");
    expect(tagsParamOf(url)).toBe("solo");
  });
});
