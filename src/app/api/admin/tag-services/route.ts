import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth";
import { apiLog } from "@/lib/logger";
import { prisma } from "@/lib/db";
import { getHydrusClient } from "@/lib/hydrus/client";
import {
  MAX_SELECTED_SERVICES,
  getTagServiceSelection,
  getTagServiceState,
  listTagServices,
  normalizeSelectionKeys,
  normalizeServiceKey,
  updateTagServiceSelection,
  type TagServiceInfo,
} from "@/lib/hydrus/tag-services";

// One quick retry: this backs an interactive admin page, which should show
// "Hydrus unreachable" promptly instead of riding out sync-grade backoff.
const ADMIN_HYDRUS_MAX_RETRIES = 1;

async function fetchTagServices(): Promise<{ services: TagServiceInfo[] | null; hydrusError?: string }> {
  try {
    const services = await listTagServices(getHydrusClient(), { maxRetries: ADMIN_HYDRUS_MAX_RETRIES });
    return { services };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    apiLog.warn({ error: message }, "Failed to list Hydrus tag services");
    return { services: null, hydrusError: `Could not reach Hydrus: ${message}` };
  }
}

function findMissingKeys(serviceKeys: string[] | null, services: TagServiceInfo[] | null): string[] {
  if (!serviceKeys || !services) return [];
  const known = new Set(services.map((s) => s.serviceKey));
  return serviceKeys.filter((key) => !known.has(key));
}

// GET - Available tag services, the stored selection, and whether a full sync
// is still needed to apply it. The selection is returned even when Hydrus is
// unreachable so the admin can still see (and fix) what is stored.
export async function GET() {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  try {
    const [{ selection, pendingResync }, { services, hydrusError }] = await Promise.all([
      getTagServiceState(),
      fetchTagServices(),
    ]);

    return NextResponse.json({
      services,
      ...(hydrusError ? { hydrusError } : {}),
      selection,
      missingKeys: findMissingKeys(selection.serviceKeys, services),
      pendingResync,
    });
  } catch (error) {
    apiLog.error({ error: error instanceof Error ? error.message : String(error) }, "Failed to get tag service settings");
    return NextResponse.json({ error: "Failed to get tag service settings" }, { status: 500 });
  }
}

// PUT - Save the selection. Takes effect on the next full sync.
export async function PUT(request: NextRequest) {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { serviceKeys: rawKeys, includePending } = body as { serviceKeys?: unknown; includePending?: unknown };

  let serviceKeys: string[] | null = null;
  if (rawKeys !== null) {
    if (!Array.isArray(rawKeys)) {
      return NextResponse.json({ error: "serviceKeys must be an array of service keys or null" }, { status: 400 });
    }
    if (rawKeys.length > MAX_SELECTED_SERVICES) {
      return NextResponse.json({ error: `At most ${MAX_SELECTED_SERVICES} tag services can be selected` }, { status: 400 });
    }
    serviceKeys = [];
    for (const raw of rawKeys) {
      const key = normalizeServiceKey(raw);
      if (!key) {
        return NextResponse.json({ error: "serviceKeys must contain hexadecimal Hydrus service keys" }, { status: 400 });
      }
      serviceKeys.push(key);
    }
  }
  if (includePending !== undefined && typeof includePending !== "boolean") {
    return NextResponse.json({ error: "includePending must be a boolean" }, { status: 400 });
  }

  try {
    // The running sync snapshotted the old selection; changing it mid-run
    // would make the recorded "applied" state ambiguous.
    const syncState = await prisma.syncState.findFirst({ select: { status: true } });
    if (syncState?.status === "running") {
      return NextResponse.json({ error: "Cannot change tag services while a sync is running" }, { status: 409 });
    }

    const { services } = await fetchTagServices();
    const unknown = findMissingKeys(serviceKeys, services);
    if (unknown.length > 0) {
      return NextResponse.json({ error: `Unknown tag service key(s): ${unknown.join(", ")}` }, { status: 400 });
    }

    const current = await getTagServiceSelection();
    await updateTagServiceSelection({
      serviceKeys: normalizeSelectionKeys(serviceKeys, services),
      includePending: includePending ?? current.includePending,
    });

    const state = await getTagServiceState();
    return NextResponse.json({
      message: "Tag service selection saved",
      selection: state.selection,
      pendingResync: state.pendingResync,
    });
  } catch (error) {
    apiLog.error({ error: error instanceof Error ? error.message : String(error) }, "Failed to save tag service settings");
    return NextResponse.json({ error: "Failed to save tag service settings" }, { status: 500 });
  }
}
