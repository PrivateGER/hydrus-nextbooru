import { prisma } from "@/lib/db";
import { OpenRouterClient, OpenRouterConfigError } from "./client";
import { DEFAULT_BASE_URL, normalizeBaseUrl } from "./base-url";
import {
  SETTINGS_KEYS,
  type OpenRouterSettings,
  type TranslationSettings,
  type LlmProvider,
} from "./types";

/**
 * Error thrown when an admin-supplied base URL fails SSRF validation.
 */
export class UnsafeBaseUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeBaseUrlError";
  }
}

/**
 * SSRF policy decision for `local.baseUrl`:
 *
 * The local provider is explicitly meant to target a user's own local LLM
 * runtime (Ollama, LM Studio, llama.cpp, ...), which legitimately listens on
 * loopback (127.0.0.1 / localhost / ::1). We therefore ALLOW loopback by
 * default for the local provider. We still BLOCK the dangerous targets that a
 * local LLM never needs and that an attacker would abuse:
 *   - non-http(s) schemes (file:, gopher:, javascript:, data:, ...)
 *   - embedded credentials (user:pass@host)
 *   - cloud metadata / link-local: 169.254.0.0/16 (incl. 169.254.169.254),
 *     IPv6 link-local fe80::/10, and known metadata hostnames.
 *   - other RFC1918 private ranges that are NOT loopback: 10/8, 172.16/12,
 *     192.168/16, plus IPv6 unique-local fc00::/7.
 *
 * Tradeoff: we validate the parsed URL host (literal IPs are decoded and range
 * checked). We do NOT perform DNS resolution at the write boundary — for
 * single-process self-hosting that is acceptable, and loopback (the desired
 * case) is exactly what a DNS-rebind attack would resolve to anyway. The
 * remote OpenRouter base URL ({allowLoopback: false}) does not permit loopback
 * or any private range.
 */
export interface BaseUrlValidationOptions {
  /** Allow loopback hosts (127.0.0.0/8, localhost, ::1). Default: false. */
  allowLoopback?: boolean;
}

/** Hostnames that resolve to cloud metadata services — always blocked. */
const BLOCKED_HOSTNAMES = new Set([
  "metadata.google.internal",
  "metadata",
  "metadata.goog",
]);

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value >>> 0;
}

function isPrivateIpv4(ip: string, allowLoopback: boolean): boolean {
  const value = ipv4ToInt(ip);
  if (value === null) return false;
  const inRange = (cidrBase: string, bits: number) => {
    const base = ipv4ToInt(cidrBase)!;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (value & mask) === (base & mask);
  };
  // Loopback 127.0.0.0/8 — allowed only when explicitly permitted.
  if (inRange("127.0.0.0", 8)) return !allowLoopback;
  // Link-local / cloud metadata 169.254.0.0/16 (incl. 169.254.169.254).
  if (inRange("169.254.0.0", 16)) return true;
  // RFC1918 private ranges.
  if (inRange("10.0.0.0", 8)) return true;
  if (inRange("172.16.0.0", 12)) return true;
  if (inRange("192.168.0.0", 16)) return true;
  // Carrier-grade NAT, "this host", broadcast.
  if (inRange("100.64.0.0", 10)) return true;
  if (inRange("0.0.0.0", 8)) return true;
  return false;
}

/** Strip an IPv6 zone id and surrounding brackets, lowercase. */
function normalizeIpv6(host: string): string {
  return host.replace(/^\[/, "").replace(/\]$/, "").split("%")[0].toLowerCase();
}

function isBlockedIpv6(host: string, allowLoopback: boolean): boolean {
  const addr = normalizeIpv6(host);
  if (!addr.includes(":")) return false;
  // Loopback ::1
  if (addr === "::1" || addr === "0:0:0:0:0:0:0:1") return !allowLoopback;
  // Unspecified ::
  if (addr === "::" || addr === "0:0:0:0:0:0:0:0") return true;
  // Link-local fe80::/10 (first hextet fe80–febf, always 4 hex digits)
  if (/^fe[89ab][0-9a-f]:/.test(addr)) return true;
  // Unique-local fc00::/7 (first hextet fc00–fdff, always 4 hex digits)
  if (/^f[cd][0-9a-f]{2}:/.test(addr)) return true;
  // IPv4-mapped ::ffff:a.b.c.d — validate the embedded IPv4.
  const mappedDotted = addr.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedDotted) return isPrivateIpv4(mappedDotted[1], allowLoopback);
  // IPv4-mapped in hex form ::ffff:hhhh:hhhh (the URL parser normalizes the
  // dotted form into this). Decode the trailing two 16-bit groups to dotted.
  const mappedHex = addr.match(/::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const high = parseInt(mappedHex[1], 16);
    const low = parseInt(mappedHex[2], 16);
    const dotted = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
    return isPrivateIpv4(dotted, allowLoopback);
  }
  return false;
}

/**
 * Validate an admin-supplied base URL against SSRF abuse.
 *
 * @throws UnsafeBaseUrlError if the URL is malformed, uses a non-http(s)
 *   scheme, embeds credentials, or targets a blocked host/IP range.
 * @returns the original URL string when valid.
 */
export function assertSafeBaseUrl(
  rawUrl: string,
  options: BaseUrlValidationOptions = {}
): string {
  const allowLoopback = options.allowLoopback ?? false;
  const trimmed = rawUrl.trim();

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new UnsafeBaseUrlError("Base URL is not a valid absolute URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeBaseUrlError(
      `Base URL scheme '${url.protocol}' is not allowed; use http or https.`
    );
  }

  if (url.username || url.password) {
    throw new UnsafeBaseUrlError("Base URL must not contain embedded credentials.");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new UnsafeBaseUrlError(
      `Base URL host '${hostname}' targets a blocked metadata endpoint.`
    );
  }

  if (hostname === "localhost") {
    if (!allowLoopback) {
      throw new UnsafeBaseUrlError("Base URL must not target localhost.");
    }
    return trimmed;
  }

  // IPv6 literal (URL hostname keeps brackets).
  if (hostname.includes(":") || hostname.startsWith("[")) {
    if (isBlockedIpv6(hostname, allowLoopback)) {
      throw new UnsafeBaseUrlError(
        `Base URL host '${hostname}' targets a blocked or private address.`
      );
    }
    return trimmed;
  }

  // IPv4 literal.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    if (isPrivateIpv4(hostname, allowLoopback)) {
      throw new UnsafeBaseUrlError(
        `Base URL host '${hostname}' targets a blocked or private address.`
      );
    }
  }

  return trimmed;
}

/**
 * Validate the local provider's base URL. Loopback is permitted because the
 * local provider is meant to reach a user's own LLM runtime.
 */
export function validateLocalBaseUrl(rawUrl: string): string {
  return assertSafeBaseUrl(rawUrl, { allowLoopback: true });
}

/**
 * Validate the remote OpenRouter base URL. Loopback and private ranges are
 * never permitted for a remote API endpoint.
 */
export function validateOpenRouterBaseUrl(rawUrl: string): string {
  return assertSafeBaseUrl(rawUrl, { allowLoopback: false });
}

/**
 * Load translation configuration from the database.
 */
export async function getTranslationSettings(): Promise<TranslationSettings> {
  const settings = await prisma.settings.findMany({
    where: {
      key: {
        in: Object.values(SETTINGS_KEYS),
      },
    },
  });

  const settingsMap = new Map(settings.map((s) => [s.key, s.value]));

  const provider = (settingsMap.get(SETTINGS_KEYS.PROVIDER) as LlmProvider | undefined) || "openrouter";

  return {
    provider,
    targetLang: settingsMap.get(SETTINGS_KEYS.TARGET_LANG) || null,
    openrouter: {
      apiKey: settingsMap.get(SETTINGS_KEYS.API_KEY) || null,
      model: settingsMap.get(SETTINGS_KEYS.MODEL) || null,
      baseUrl: settingsMap.get(SETTINGS_KEYS.BASE_URL) || null,
    },
    local: {
      apiKey: settingsMap.get(SETTINGS_KEYS.LOCAL_API_KEY) || null,
      model: settingsMap.get(SETTINGS_KEYS.LOCAL_MODEL) || null,
      baseUrl: settingsMap.get(SETTINGS_KEYS.LOCAL_BASE_URL) || null,
    },
  };
}

/**
 * Load active provider configuration for translation calls.
 */
export async function getOpenRouterSettings(): Promise<OpenRouterSettings> {
  const settings = await getTranslationSettings();
  const active = settings.provider === "local" ? settings.local : settings.openrouter;

  return {
    apiKey: active.apiKey,
    model: active.model,
    targetLang: settings.targetLang,
    baseUrl:
      active.baseUrl ||
      (settings.provider === "openrouter" ? DEFAULT_BASE_URL : null),
  };
}

/**
 * Upserts a settings entry in the database for the given key with the provided value.
 *
 * @param key - The settings key to create or update
 * @param value - The value to assign to the settings key
 */
export async function updateSetting(key: string, value: string): Promise<void> {
  await prisma.settings.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

/**
 * Upserts multiple configuration settings in a single transactional operation.
 *
 * Filters out entries whose value is `undefined` and creates or updates each remaining key/value pair.
 *
 * @param settings - A map of setting keys to values; entries with `undefined` values are ignored. 
 */
export async function updateSettings(
  settings: Partial<Record<string, string>>
): Promise<void> {
  const operations = Object.entries(settings)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) =>
      prisma.settings.upsert({
        where: { key },
        update: { value: value! },
        create: { key, value: value! },
      })
    );

  if (operations.length === 0) {
    return;
  }

  await prisma.$transaction(operations);
}

/**
 * Create an OpenRouterClient using configured settings.
 *
 * @returns An initialized OpenRouterClient configured with the resolved API key, model (if present), and default target language (if present).
 * @throws Error if the active provider is missing required settings.
 */
export async function getOpenRouterClient(): Promise<OpenRouterClient> {
  const settings = await getTranslationSettings();
  const active = settings.provider === "local" ? settings.local : settings.openrouter;

  if (settings.provider === "openrouter" && !active.apiKey) {
    throw new OpenRouterConfigError(
      "OpenRouter API key not configured. Set it in Admin Settings."
    );
  }

  if (settings.provider === "openrouter" && active.baseUrl && isCustomEndpoint(active.baseUrl) && !active.model) {
    throw new OpenRouterConfigError(
      "Model not configured for custom OpenRouter endpoint. Set it in Admin Settings."
    );
  }

  if (settings.provider === "local" && !active.model) {
    throw new OpenRouterConfigError(
      "Model not configured for Local provider. Set it in Admin Settings."
    );
  }

  if (settings.provider === "local" && !active.baseUrl) {
    throw new OpenRouterConfigError(
      "Local endpoint not configured. Set it in Admin Settings."
    );
  }

  // Defense-in-depth: re-validate the base URL at the consumption boundary in
  // case an unsafe value was persisted before validation existed (or directly
  // in the DB). Loopback is allowed for the local provider only.
  if (active.baseUrl) {
    try {
      assertSafeBaseUrl(active.baseUrl, {
        allowLoopback: settings.provider === "local",
      });
    } catch (err) {
      throw new OpenRouterConfigError(
        err instanceof UnsafeBaseUrlError
          ? `Configured endpoint is not allowed: ${err.message}`
          : "Configured endpoint is not allowed."
      );
    }
  }

  return new OpenRouterClient({
    apiKey: active.apiKey || "",
    model: active.model || undefined,
    defaultTargetLang: settings.targetLang || undefined,
    baseUrl:
      active.baseUrl ||
      (settings.provider === "openrouter" ? DEFAULT_BASE_URL : undefined),
  });
}

/**
 * Produce a masked representation of an API key for safe display.
 *
 * @param key - The API key to mask.
 * @returns A masked API key: `****` if `key` has 12 or fewer characters, otherwise the first 8 characters, `...`, and the last 4 characters.
 */
export function maskApiKey(key: string): string {
  if (key.length <= 12) {
    return "****";
  }
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}

/**
 * Check whether a base URL points to a custom (non-OpenRouter) endpoint.
 */
export function isCustomEndpoint(baseUrl: string | null | undefined): boolean {
  if (!baseUrl) return false;
  return normalizeBaseUrl(baseUrl) !== normalizeBaseUrl(DEFAULT_BASE_URL);
}

/**
 * Resolve the effective model for API calls based on endpoint type.
 */
export function getEffectiveModel(settings: OpenRouterSettings): string {
  if (settings.baseUrl && isCustomEndpoint(settings.baseUrl)) {
    if (!settings.model) {
      throw new OpenRouterConfigError(
        "Model not configured for custom OpenRouter endpoint. Set it in Admin Settings."
      );
    }
    return settings.model;
  }

  return settings.model || OpenRouterClient.getDefaultModel();
}
