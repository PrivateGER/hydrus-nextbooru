import { describe, it, expect } from "vitest";
import {
  getEffectiveModel,
  isCustomEndpoint,
  OpenRouterConfigError,
  assertSafeBaseUrl,
  validateLocalBaseUrl,
  validateOpenRouterBaseUrl,
  UnsafeBaseUrlError,
} from "@/lib/openrouter";
import { OpenRouterClient } from "@/lib/openrouter/client";

describe("isCustomEndpoint", () => {
  it("should return false when baseUrl is empty", () => {
    expect(isCustomEndpoint(null)).toBe(false);
    expect(isCustomEndpoint(undefined)).toBe(false);
    expect(isCustomEndpoint("")).toBe(false);
  });

  it("should return false for the default OpenRouter endpoint", () => {
    expect(isCustomEndpoint("https://openrouter.ai/api/v1")).toBe(false);
    expect(isCustomEndpoint("https://openrouter.ai/api/v1/")).toBe(false);
  });

  it("should return true for custom endpoints", () => {
    expect(isCustomEndpoint("https://example.com/v1")).toBe(true);
  });
});

describe("getEffectiveModel", () => {
  it("should return default model for OpenRouter with no model configured", () => {
    const model = getEffectiveModel({
      apiKey: "test-key",
      model: null,
      targetLang: null,
      baseUrl: null,
    });

    expect(model).toBe(OpenRouterClient.getDefaultModel());
  });

  it("should return configured model for custom endpoints", () => {
    const model = getEffectiveModel({
      apiKey: "test-key",
      model: "custom-model",
      targetLang: null,
      baseUrl: "https://example.com/v1",
    });

    expect(model).toBe("custom-model");
  });

  it("should throw when custom endpoint is missing a model", () => {
    expect(() =>
      getEffectiveModel({
        apiKey: "test-key",
        model: null,
        targetLang: null,
        baseUrl: "https://example.com/v1",
      })
    ).toThrow(OpenRouterConfigError);
  });
});

describe("assertSafeBaseUrl (SSRF validation)", () => {
  describe("valid / normal inputs", () => {
    it("accepts a normal remote https endpoint", () => {
      expect(assertSafeBaseUrl("https://openrouter.ai/api/v1")).toBe(
        "https://openrouter.ai/api/v1"
      );
    });

    it("accepts a normal remote http endpoint", () => {
      expect(assertSafeBaseUrl("http://api.example.com:8080/v1")).toBe(
        "http://api.example.com:8080/v1"
      );
    });

    it("accepts a public IPv4 literal", () => {
      expect(assertSafeBaseUrl("https://8.8.8.8/v1")).toBe("https://8.8.8.8/v1");
    });

    it("trims surrounding whitespace and returns the trimmed URL", () => {
      expect(assertSafeBaseUrl("  https://example.com/v1  ")).toBe(
        "https://example.com/v1"
      );
    });
  });

  describe("scheme restrictions", () => {
    it("rejects file:// URLs", () => {
      expect(() => assertSafeBaseUrl("file:///etc/passwd")).toThrow(
        UnsafeBaseUrlError
      );
    });

    it("rejects javascript: URLs", () => {
      expect(() => assertSafeBaseUrl("javascript:alert(1)")).toThrow(
        UnsafeBaseUrlError
      );
    });

    it("rejects gopher:// URLs", () => {
      expect(() => assertSafeBaseUrl("gopher://example.com/_x")).toThrow(
        UnsafeBaseUrlError
      );
    });

    it("rejects data: URLs", () => {
      expect(() => assertSafeBaseUrl("data:text/plain,hi")).toThrow(
        UnsafeBaseUrlError
      );
    });

    it("rejects malformed / non-absolute URLs", () => {
      expect(() => assertSafeBaseUrl("not a url")).toThrow(UnsafeBaseUrlError);
      expect(() => assertSafeBaseUrl("/relative/path")).toThrow(
        UnsafeBaseUrlError
      );
    });
  });

  describe("embedded credentials", () => {
    it("rejects URLs with embedded credentials", () => {
      expect(() =>
        assertSafeBaseUrl("https://user:pass@example.com/v1")
      ).toThrow(UnsafeBaseUrlError);
    });

    it("rejects credential-tricks that smuggle a metadata host", () => {
      // The real host here is example.com, but credentials are still disallowed.
      expect(() =>
        assertSafeBaseUrl("https://169.254.169.254@example.com/")
      ).toThrow(UnsafeBaseUrlError);
    });
  });

  describe("cloud metadata / link-local (always blocked)", () => {
    it("rejects the cloud metadata IP over http", () => {
      expect(() =>
        assertSafeBaseUrl("http://169.254.169.254/latest/meta-data/", {
          allowLoopback: true,
        })
      ).toThrow(UnsafeBaseUrlError);
    });

    it("rejects the whole 169.254.0.0/16 link-local range", () => {
      expect(() =>
        assertSafeBaseUrl("http://169.254.0.1/", { allowLoopback: true })
      ).toThrow(UnsafeBaseUrlError);
    });

    it("rejects the GCP metadata hostname", () => {
      expect(() =>
        assertSafeBaseUrl("http://metadata.google.internal/", {
          allowLoopback: true,
        })
      ).toThrow(UnsafeBaseUrlError);
    });
  });

  describe("private IPv4 ranges (always blocked)", () => {
    it("rejects 10.0.0.0/8", () => {
      expect(() =>
        assertSafeBaseUrl("http://10.1.2.3/v1", { allowLoopback: true })
      ).toThrow(UnsafeBaseUrlError);
    });

    it("rejects 172.16.0.0/12", () => {
      expect(() =>
        assertSafeBaseUrl("http://172.20.5.6/v1", { allowLoopback: true })
      ).toThrow(UnsafeBaseUrlError);
      // boundary: 172.32.x.x is OUTSIDE the /12 and must be allowed
      expect(
        assertSafeBaseUrl("http://172.32.0.1/v1", { allowLoopback: true })
      ).toBe("http://172.32.0.1/v1");
    });

    it("rejects 192.168.0.0/16", () => {
      expect(() =>
        assertSafeBaseUrl("http://192.168.1.10/v1", { allowLoopback: true })
      ).toThrow(UnsafeBaseUrlError);
    });
  });

  describe("loopback handling", () => {
    it("blocks loopback when allowLoopback is false (remote endpoint)", () => {
      expect(() => assertSafeBaseUrl("http://127.0.0.1:11434/v1")).toThrow(
        UnsafeBaseUrlError
      );
      expect(() => assertSafeBaseUrl("http://localhost:11434/v1")).toThrow(
        UnsafeBaseUrlError
      );
      expect(() => assertSafeBaseUrl("http://[::1]:11434/v1")).toThrow(
        UnsafeBaseUrlError
      );
    });

    it("allows loopback when allowLoopback is true (local LLM runtime)", () => {
      expect(
        assertSafeBaseUrl("http://127.0.0.1:11434/v1", { allowLoopback: true })
      ).toBe("http://127.0.0.1:11434/v1");
      expect(
        assertSafeBaseUrl("http://localhost:11434/v1", { allowLoopback: true })
      ).toBe("http://localhost:11434/v1");
      expect(
        assertSafeBaseUrl("http://[::1]:11434/v1", { allowLoopback: true })
      ).toBe("http://[::1]:11434/v1");
    });

    it("treats the whole 127.0.0.0/8 range as loopback", () => {
      expect(() => assertSafeBaseUrl("http://127.5.6.7/v1")).toThrow(
        UnsafeBaseUrlError
      );
      expect(
        assertSafeBaseUrl("http://127.5.6.7/v1", { allowLoopback: true })
      ).toBe("http://127.5.6.7/v1");
    });
  });

  describe("IPv6 adversarial inputs", () => {
    it("blocks IPv6 link-local fe80::/10", () => {
      expect(() =>
        assertSafeBaseUrl("http://[fe80::1]/v1", { allowLoopback: true })
      ).toThrow(UnsafeBaseUrlError);
    });

    it("blocks IPv6 unique-local fc00::/7", () => {
      expect(() =>
        assertSafeBaseUrl("http://[fd00::1]/v1", { allowLoopback: true })
      ).toThrow(UnsafeBaseUrlError);
    });

    it("blocks IPv4-mapped IPv6 pointing at the metadata IP", () => {
      expect(() =>
        assertSafeBaseUrl("http://[::ffff:169.254.169.254]/v1", {
          allowLoopback: true,
        })
      ).toThrow(UnsafeBaseUrlError);
    });

    it("blocks the IPv6 unspecified address ::", () => {
      expect(() =>
        assertSafeBaseUrl("http://[::]/v1", { allowLoopback: true })
      ).toThrow(UnsafeBaseUrlError);
    });
  });

  describe("DNS-rebind-style hostnames", () => {
    // A hostname like 169.254.169.254.nip.io resolves to the metadata IP at
    // fetch time. We cannot resolve DNS at the write boundary, but a bare
    // metadata hostname must be blocked, and a public-looking hostname is
    // accepted at the boundary while the consumption-time check stays defensive.
    it("blocks bare metadata hostnames", () => {
      expect(() =>
        assertSafeBaseUrl("http://metadata/", { allowLoopback: true })
      ).toThrow(UnsafeBaseUrlError);
    });

    it("accepts a public hostname that only looks suspicious by name", () => {
      // Cannot resolve DNS here; host-based literal check passes. Documented
      // tradeoff — defense-in-depth lives at the consumption boundary.
      expect(
        assertSafeBaseUrl("https://my-internal-llm.example.com/v1")
      ).toBe("https://my-internal-llm.example.com/v1");
    });
  });
});

describe("validateLocalBaseUrl / validateOpenRouterBaseUrl wrappers", () => {
  it("validateLocalBaseUrl allows loopback but blocks metadata", () => {
    expect(validateLocalBaseUrl("http://127.0.0.1:11434/v1")).toBe(
      "http://127.0.0.1:11434/v1"
    );
    expect(() => validateLocalBaseUrl("http://169.254.169.254/")).toThrow(
      UnsafeBaseUrlError
    );
  });

  it("validateOpenRouterBaseUrl blocks loopback and private ranges", () => {
    expect(() => validateOpenRouterBaseUrl("http://127.0.0.1/v1")).toThrow(
      UnsafeBaseUrlError
    );
    expect(() => validateOpenRouterBaseUrl("http://foo.localhost/v1")).toThrow(
      UnsafeBaseUrlError
    );
    expect(() => validateOpenRouterBaseUrl("http://192.168.0.1/v1")).toThrow(
      UnsafeBaseUrlError
    );
    expect(validateOpenRouterBaseUrl("https://openrouter.ai/api/v1")).toBe(
      "https://openrouter.ai/api/v1"
    );
  });
});
