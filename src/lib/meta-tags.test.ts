import { describe, it, expect } from "vitest";
import {
  isMetaTag,
  getMetaTagDefinition,
  getAllMetaTags,
  searchMetaTags,
  requiresRawSql,
  getOrientationSqlCondition,
  separateMetaTags,
} from "./meta-tags";

describe("isMetaTag", () => {
  it("should recognize media type meta tags", () => {
    expect(isMetaTag("video")).toBe(true);
    expect(isMetaTag("animated")).toBe(true);
  });

  it("should recognize orientation meta tags", () => {
    expect(isMetaTag("portrait")).toBe(true);
    expect(isMetaTag("landscape")).toBe(true);
    expect(isMetaTag("square")).toBe(true);
  });

  it("should recognize resolution meta tags", () => {
    expect(isMetaTag("highres")).toBe(true);
    expect(isMetaTag("lowres")).toBe(true);
  });

  it("should be case-insensitive", () => {
    expect(isMetaTag("VIDEO")).toBe(true);
    expect(isMetaTag("Video")).toBe(true);
    expect(isMetaTag("PORTRAIT")).toBe(true);
  });

  it("should return false for non-meta tags", () => {
    expect(isMetaTag("blue_eyes")).toBe(false);
    expect(isMetaTag("character:saber")).toBe(false);
    expect(isMetaTag("artist:unknown")).toBe(false);
    expect(isMetaTag("solo")).toBe(false);
  });
});

describe("getMetaTagDefinition", () => {
  it("should return definition for valid meta tag", () => {
    const def = getMetaTagDefinition("video");
    expect(def).toBeDefined();
    expect(def?.name).toBe("video");
    expect(def?.category).toBe("type");
    expect(def?.description).toContain("Video");
  });

  it("should be case-insensitive", () => {
    const def = getMetaTagDefinition("VIDEO");
    expect(def).toBeDefined();
    expect(def?.name).toBe("video");
  });

  it("should return undefined for non-meta tag", () => {
    expect(getMetaTagDefinition("blue_eyes")).toBeUndefined();
    expect(getMetaTagDefinition("not_a_meta_tag")).toBeUndefined();
  });
});

describe("getAllMetaTags", () => {
  it("should return all meta tag definitions", () => {
    const all = getAllMetaTags();
    expect(all.length).toBeGreaterThan(0);

    // Check expected meta tags are present
    const names = all.map((def) => def.name);
    expect(names).toContain("video");
    expect(names).toContain("animated");
    expect(names).toContain("portrait");
    expect(names).toContain("landscape");
    expect(names).toContain("square");
    expect(names).toContain("highres");
    expect(names).toContain("lowres");
  });

  it("should return immutable copies", () => {
    const all1 = getAllMetaTags();
    const all2 = getAllMetaTags();
    expect(all1).not.toBe(all2); // Different array instances
    expect(all1).toEqual(all2); // Same content
  });
});

describe("searchMetaTags", () => {
  it("should return all meta tags when query is empty", () => {
    const results = searchMetaTags("");
    expect(results.length).toBe(getAllMetaTags().length);
  });

  it("should filter by name", () => {
    const results = searchMetaTags("video");
    expect(results.some((def) => def.name === "video")).toBe(true);
  });

  it("should filter by partial name", () => {
    const results = searchMetaTags("port");
    expect(results.some((def) => def.name === "portrait")).toBe(true);
  });

  it("should filter by description", () => {
    const results = searchMetaTags("HD");
    expect(results.some((def) => def.name === "highres")).toBe(true);
  });

  it("should be case-insensitive", () => {
    const results = searchMetaTags("VIDEO");
    expect(results.some((def) => def.name === "video")).toBe(true);
  });

  it("should return empty array for non-matching query", () => {
    const results = searchMetaTags("nonexistent_xyz");
    expect(results).toEqual([]);
  });
});

describe("requiresRawSql", () => {
  it("should return true for orientation tags", () => {
    expect(requiresRawSql("portrait")).toBe(true);
    expect(requiresRawSql("landscape")).toBe(true);
    expect(requiresRawSql("square")).toBe(true);
  });

  it("should be case-insensitive", () => {
    expect(requiresRawSql("PORTRAIT")).toBe(true);
    expect(requiresRawSql("Landscape")).toBe(true);
  });

  it("should return false for non-orientation meta tags", () => {
    expect(requiresRawSql("video")).toBe(false);
    expect(requiresRawSql("animated")).toBe(false);
    expect(requiresRawSql("highres")).toBe(false);
    expect(requiresRawSql("lowres")).toBe(false);
  });

  it("should return false for non-meta tags", () => {
    expect(requiresRawSql("blue_eyes")).toBe(false);
  });
});

describe("getOrientationSqlCondition", () => {
  it("should generate portrait condition", () => {
    const sql = getOrientationSqlCondition("portrait");
    expect(sql.strings.join("")).toContain("height");
    expect(sql.strings.join("")).toContain("width");
    expect(sql.strings.join("")).toContain(">");
  });

  it("should generate landscape condition", () => {
    const sql = getOrientationSqlCondition("landscape");
    expect(sql.strings.join("")).toContain("width");
    expect(sql.strings.join("")).toContain("height");
    expect(sql.strings.join("")).toContain(">");
  });

  it("should generate square condition", () => {
    const sql = getOrientationSqlCondition("square");
    expect(sql.strings.join("")).toContain("width");
    expect(sql.strings.join("")).toContain("height");
    expect(sql.strings.join("")).toContain("=");
  });

  it("should generate negated condition", () => {
    const sql = getOrientationSqlCondition("portrait", true);
    expect(sql.strings.join("")).toContain("NOT");
  });

  it("should throw for unknown orientation tag", () => {
    expect(() => getOrientationSqlCondition("video")).toThrow("Unknown orientation tag");
  });
});

describe("separateMetaTags", () => {
  it("should separate meta tags from regular tags", () => {
    const result = separateMetaTags(["video", "blue_eyes", "portrait"]);
    expect(result.metaTags.include).toEqual(["video", "portrait"]);
    expect(result.regularTags.include).toEqual(["blue_eyes"]);
  });

  it("should handle negated tags", () => {
    const result = separateMetaTags(["-video", "blue_eyes", "-portrait"]);
    expect(result.metaTags.exclude).toEqual(["video", "portrait"]);
    expect(result.regularTags.include).toEqual(["blue_eyes"]);
  });

  it("should handle mixed negation", () => {
    const result = separateMetaTags(["video", "-animated", "solo", "-blue_eyes"]);
    expect(result.metaTags.include).toEqual(["video"]);
    expect(result.metaTags.exclude).toEqual(["animated"]);
    expect(result.regularTags.include).toEqual(["solo"]);
    expect(result.regularTags.exclude).toEqual(["blue_eyes"]);
  });

  it("should handle empty array", () => {
    const result = separateMetaTags([]);
    expect(result.metaTags.include).toEqual([]);
    expect(result.metaTags.exclude).toEqual([]);
    expect(result.regularTags.include).toEqual([]);
    expect(result.regularTags.exclude).toEqual([]);
  });

  it("should handle all meta tags", () => {
    const result = separateMetaTags(["video", "portrait", "highres"]);
    expect(result.metaTags.include).toEqual(["video", "portrait", "highres"]);
    expect(result.regularTags.include).toEqual([]);
  });

  it("should handle all regular tags", () => {
    const result = separateMetaTags(["blue_eyes", "blonde_hair", "solo"]);
    expect(result.metaTags.include).toEqual([]);
    expect(result.regularTags.include).toEqual(["blue_eyes", "blonde_hair", "solo"]);
  });

  it("should trim whitespace and skip empty strings", () => {
    const result = separateMetaTags(["  video  ", "", "  blue_eyes  ", "  "]);
    expect(result.metaTags.include).toEqual(["video"]);
    expect(result.regularTags.include).toEqual(["blue_eyes"]);
  });

  it("should handle double negation correctly", () => {
    // "--tag" should be treated as negating a tag named "-tag"
    const result = separateMetaTags(["--something"]);
    expect(result.regularTags.exclude).toEqual(["-something"]);
  });
});

describe("meta tag Prisma conditions", () => {
  it("video condition should filter by mimeType", () => {
    const def = getMetaTagDefinition("video");
    expect(def?.getCondition).toBeDefined();
    const condition = def!.getCondition!();
    expect(condition).toHaveProperty("mimeType");
  });

  it("animated condition should filter by mimeType", () => {
    const def = getMetaTagDefinition("animated");
    expect(def?.getCondition).toBeDefined();
    const condition = def!.getCondition!();
    expect(condition).toHaveProperty("mimeType");
  });

  it("highres condition should filter by dimensions", () => {
    const def = getMetaTagDefinition("highres");
    expect(def?.getCondition).toBeDefined();
    const condition = def!.getCondition!();
    expect(condition).toHaveProperty("OR");
  });

  it("lowres condition should filter by dimensions", () => {
    const def = getMetaTagDefinition("lowres");
    expect(def?.getCondition).toBeDefined();
    const condition = def!.getCondition!();
    expect(condition).toHaveProperty("AND");
  });

  it("orientation tags should not have getCondition (use raw SQL instead)", () => {
    const portrait = getMetaTagDefinition("portrait");
    const landscape = getMetaTagDefinition("landscape");
    const square = getMetaTagDefinition("square");
    expect(portrait?.getCondition).toBeUndefined();
    expect(landscape?.getCondition).toBeUndefined();
    expect(square?.getCondition).toBeUndefined();
  });
});

describe("meta-tags and meta-tags-shared sync", () => {
  it("should have matching meta tag names in both files", async () => {
    // Import the shared module's isMetaTag to verify it recognizes all server-side tags
    const { isMetaTag: isMetaTagShared } = await import("./meta-tags-shared");

    // Get all meta tag names from the server-side definitions
    const serverMetaTagNames = getAllMetaTags().map((def) => def.name);

    // Verify each server-side meta tag is recognized by the shared module
    for (const name of serverMetaTagNames) {
      expect(isMetaTagShared(name)).toBe(true);
    }
  });

  it("should recognize the same set of meta tags in both modules", async () => {
    const { isMetaTag: isMetaTagShared } = await import("./meta-tags-shared");

    // Known meta tags from server definitions
    const serverMetaTagNames = getAllMetaTags().map((def) => def.name);

    // Test that both modules agree on what is/isn't a meta tag
    const testTags = [
      ...serverMetaTagNames,
      "not_a_meta_tag",
      "blue_eyes",
      "solo",
    ];

    for (const tag of testTags) {
      expect(isMetaTag(tag)).toBe(isMetaTagShared(tag));
    }
  });
});
