import { prisma } from "@/lib/db";
import { syncLog } from "@/lib/logger";
import type { HydrusClient } from "./client";
import {
  HydrusTagServiceType,
  HydrusTagStatus,
  type HydrusFileMetadata,
  type HydrusServicesObject,
} from "./types";

/**
 * Single source of truth for which Hydrus tag services sync imports.
 *
 * The selection lives in the generic Settings table. Unset (or empty) means
 * "every service", which is exactly the pre-existing behaviour: union the
 * current display tags of every entry in `metadata.tags`. Services are always
 * identified by service key; names are user-editable and never stored.
 *
 * A changed selection only takes effect on the next FULL sync (incremental
 * syncs touch a subset of posts, and only a full sync's orphan cleanup drops
 * tags that are no longer imported), which is what the applied fingerprint
 * tracks.
 */

export const TAG_SERVICE_SETTINGS_KEYS = {
  SERVICE_KEYS: "hydrus.tagServiceKeys",
  INCLUDE_PENDING: "hydrus.tagServices.includePending",
  APPLIED_FINGERPRINT: "hydrus.tagServices.appliedFingerprint",
} as const;

/** Hydrus service keys are hex; real ones are ~20-64 chars. Bounded for storage safety. */
export const MAX_SERVICE_KEY_LENGTH = 128;
/** Upper bound on how many services a selection may name. */
export const MAX_SELECTED_SERVICES = 64;

const SERVICE_KEY_PATTERN = /^[0-9a-f]+$/;

const TAG_SERVICE_TYPES = new Set<number>(Object.values(HydrusTagServiceType));

export interface TagServiceSelection {
  /** Lowercased hex service keys; null = every service (default behaviour). */
  serviceKeys: string[] | null;
  /** Also import pending ("1") tags, not just current ("0") ones. */
  includePending: boolean;
}

export const DEFAULT_TAG_SERVICE_SELECTION: TagServiceSelection = {
  serviceKeys: null,
  includePending: false,
};

/** Resolved, per-sync tag filter applied while reading file metadata. */
export interface TagServiceFilter {
  /** Lowercased service keys to read from; null = every entry. */
  allowed: ReadonlySet<string> | null;
  includePending: boolean;
}

export const ALL_TAG_SERVICES_FILTER: TagServiceFilter = {
  allowed: null,
  includePending: false,
};

export interface TagServiceInfo {
  serviceKey: string;
  name: string;
  type: number;
  typePretty: string;
}

/** Normalize a candidate service key, or null if it is not a bounded hex string. */
export function normalizeServiceKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  if (!key || key.length > MAX_SERVICE_KEY_LENGTH || !SERVICE_KEY_PATTERN.test(key)) {
    return null;
  }
  return key;
}

function parseServiceKeys(raw: string | undefined): string[] | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    syncLog.warn({ key: TAG_SERVICE_SETTINGS_KEYS.SERVICE_KEYS }, "Ignoring malformed tag service selection; importing all services");
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const keys = new Set<string>();
  for (const entry of parsed) {
    const key = normalizeServiceKey(entry);
    if (key) keys.add(key);
  }
  return keys.size > 0 ? [...keys].sort() : null;
}

interface StoredTagServiceSettings {
  selection: TagServiceSelection;
  appliedFingerprint: string | null;
}

async function readTagServiceSettings(): Promise<StoredTagServiceSettings> {
  const rows = await prisma.settings.findMany({
    where: { key: { in: Object.values(TAG_SERVICE_SETTINGS_KEYS) } },
  });
  const settings = new Map(rows.map((row) => [row.key, row.value]));

  return {
    selection: {
      serviceKeys: parseServiceKeys(settings.get(TAG_SERVICE_SETTINGS_KEYS.SERVICE_KEYS)),
      includePending: settings.get(TAG_SERVICE_SETTINGS_KEYS.INCLUDE_PENDING) === "true",
    },
    appliedFingerprint: settings.get(TAG_SERVICE_SETTINGS_KEYS.APPLIED_FINGERPRINT) || null,
  };
}

export async function getTagServiceSelection(): Promise<TagServiceSelection> {
  return (await readTagServiceSettings()).selection;
}

/** Selection plus whether a full sync is still needed to apply it. */
export async function getTagServiceState(): Promise<{
  selection: TagServiceSelection;
  pendingResync: boolean;
}> {
  const { selection, appliedFingerprint } = await readTagServiceSettings();
  return { selection, pendingResync: isResyncPending(selection, appliedFingerprint) };
}

/**
 * Persist a selection. Keys must already be validated/normalized by the
 * caller (normalizeSelectionInput); null or empty clears back to "all".
 */
export async function updateTagServiceSelection(selection: TagServiceSelection): Promise<void> {
  const keys = selection.serviceKeys && selection.serviceKeys.length > 0
    ? [...new Set(selection.serviceKeys)].sort()
    : null;

  await prisma.$transaction([
    keys
      ? prisma.settings.upsert({
          where: { key: TAG_SERVICE_SETTINGS_KEYS.SERVICE_KEYS },
          update: { value: JSON.stringify(keys) },
          create: { key: TAG_SERVICE_SETTINGS_KEYS.SERVICE_KEYS, value: JSON.stringify(keys) },
        })
      : prisma.settings.deleteMany({ where: { key: TAG_SERVICE_SETTINGS_KEYS.SERVICE_KEYS } }),
    prisma.settings.upsert({
      where: { key: TAG_SERVICE_SETTINGS_KEYS.INCLUDE_PENDING },
      update: { value: String(selection.includePending) },
      create: { key: TAG_SERVICE_SETTINGS_KEYS.INCLUDE_PENDING, value: String(selection.includePending) },
    }),
  ]);
}

/** Record that the database now reflects `selection` (after a clean full sync). */
export async function markTagServiceSelectionApplied(selection: TagServiceSelection): Promise<void> {
  const value = selectionFingerprint(selection);
  await prisma.settings.upsert({
    where: { key: TAG_SERVICE_SETTINGS_KEYS.APPLIED_FINGERPRINT },
    update: { value },
    create: { key: TAG_SERVICE_SETTINGS_KEYS.APPLIED_FINGERPRINT, value },
  });
}

/** Order- and case-independent identity of a selection. */
export function selectionFingerprint(selection: TagServiceSelection): string {
  const keys = selection.serviceKeys && selection.serviceKeys.length > 0
    ? [...new Set(selection.serviceKeys.map((k) => k.toLowerCase()))].sort()
    : null;
  return JSON.stringify({ keys, pending: selection.includePending });
}

export function isDefaultSelection(selection: TagServiceSelection): boolean {
  return (!selection.serviceKeys || selection.serviceKeys.length === 0) && !selection.includePending;
}

/**
 * Whether the stored selection differs from what the last clean full sync
 * applied. An install that never recorded a fingerprint is treated as having
 * applied the default, so upgrading does not nag for a resync.
 */
export function isResyncPending(selection: TagServiceSelection, appliedFingerprint: string | null): boolean {
  if (appliedFingerprint === null) return !isDefaultSelection(selection);
  return appliedFingerprint !== selectionFingerprint(selection);
}

/** Tag services only, sorted: all known tags, then local services, then repositories. */
export function filterTagServices(services: HydrusServicesObject): TagServiceInfo[] {
  const rank = (type: number) =>
    type === HydrusTagServiceType.AllKnownTags ? 0 : type === HydrusTagServiceType.LocalTag ? 1 : 2;

  return Object.entries(services ?? {})
    .filter(([, service]) => service && TAG_SERVICE_TYPES.has(service.type))
    .map(([serviceKey, service]) => ({
      serviceKey: serviceKey.toLowerCase(),
      name: service.name,
      type: service.type,
      typePretty: service.type_pretty,
    }))
    .sort((a, b) => rank(a.type) - rank(b.type) || a.name.localeCompare(b.name));
}

export async function listTagServices(
  client: HydrusClient,
  options?: { maxRetries?: number }
): Promise<TagServiceInfo[]> {
  const response = await client.getServices(options);
  return filterTagServices(response.services);
}

/**
 * Resolve a stored selection against the services Hydrus currently reports.
 * `allowed` is null when every service should be read: no selection, or
 * "all known tags" selected (it is the union of everything, so it subsumes
 * any other key). `missing` lists selected keys Hydrus no longer has; the
 * caller must fail closed on them rather than silently drop their tags.
 */
export function resolveSelection(
  selection: TagServiceSelection,
  available: TagServiceInfo[]
): { allowed: Set<string> | null; missing: string[] } {
  if (!selection.serviceKeys || selection.serviceKeys.length === 0) {
    return { allowed: null, missing: [] };
  }

  const byKey = new Map(available.map((s) => [s.serviceKey.toLowerCase(), s]));
  const allowed = new Set<string>();
  const missing: string[] = [];
  let includesAllKnown = false;

  for (const raw of selection.serviceKeys) {
    const key = raw.toLowerCase();
    const service = byKey.get(key);
    if (!service) {
      missing.push(key);
      continue;
    }
    if (service.type === HydrusTagServiceType.AllKnownTags) {
      includesAllKnown = true;
    }
    allowed.add(key);
  }

  return { allowed: includesAllKnown ? null : allowed, missing };
}

/**
 * Normalize an admin-supplied selection: lowercase + dedupe, and collapse
 * "all known tags" (alone or mixed with others) to unset. `available` is
 * optional because the selection is still saveable while Hydrus is down.
 */
export function normalizeSelectionKeys(
  keys: string[] | null,
  available: TagServiceInfo[] | null
): string[] | null {
  if (!keys || keys.length === 0) return null;
  const unique = [...new Set(keys.map((k) => k.toLowerCase()))].sort();
  if (available) {
    const allKnown = new Set(
      available.filter((s) => s.type === HydrusTagServiceType.AllKnownTags).map((s) => s.serviceKey)
    );
    if (unique.some((k) => allKnown.has(k))) return null;
  }
  return unique;
}

/**
 * Walk every display tag the filter admits. Keeps the defensive guards the
 * original extractor had: any missing/malformed level is skipped, never thrown.
 */
export function forEachDisplayTag(
  metadata: HydrusFileMetadata,
  filter: TagServiceFilter,
  visit: (tag: string) => void
): void {
  if (!metadata.tags || typeof metadata.tags !== "object") return;

  const statuses: string[] = filter.includePending
    ? [HydrusTagStatus.Current, HydrusTagStatus.Pending]
    : [HydrusTagStatus.Current];

  for (const [serviceKey, serviceTags] of Object.entries(metadata.tags)) {
    if (filter.allowed && !filter.allowed.has(serviceKey.toLowerCase())) continue;
    if (!serviceTags || typeof serviceTags !== "object") continue;

    // Display tags = after sibling/parent processing
    const displayTags = serviceTags.display_tags;
    if (!displayTags || typeof displayTags !== "object") continue;

    for (const status of statuses) {
      const tags = displayTags[status];
      if (!Array.isArray(tags)) continue;

      for (const tag of tags) {
        if (typeof tag !== "string" || !tag) continue;
        visit(tag);
      }
    }
  }
}

/** Collect the filter's display tags (in encounter order, duplicates kept). */
export function collectDisplayTags(metadata: HydrusFileMetadata, filter: TagServiceFilter): string[] {
  const tags: string[] = [];
  forEachDisplayTag(metadata, filter, (tag) => tags.push(tag));
  return tags;
}
