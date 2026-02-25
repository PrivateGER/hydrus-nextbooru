export const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

export function isCustomEndpointUrl(baseUrl: string | null | undefined): boolean {
  if (!baseUrl) return false;
  return normalizeBaseUrl(baseUrl) !== normalizeBaseUrl(DEFAULT_BASE_URL);
}
