import { describe, expect, it } from "vitest";
import { resolveApiKeyUpdate } from "@/hooks/admin/use-translation";

describe("resolveApiKeyUpdate", () => {
  it("omits api key updates when a key is already configured and input is blank", () => {
    expect(resolveApiKeyUpdate("", true)).toBeUndefined();
    expect(resolveApiKeyUpdate("   ", true)).toBeUndefined();
  });

  it("allows blank input when no key is configured yet", () => {
    expect(resolveApiKeyUpdate("", false)).toBe("");
    expect(resolveApiKeyUpdate("   ", false)).toBe("");
  });

  it("returns trimmed api key when provided", () => {
    expect(resolveApiKeyUpdate(" new-openrouter-key ", true)).toBe("new-openrouter-key");
    expect(resolveApiKeyUpdate("new-local-key", false)).toBe("new-local-key");
  });
});
