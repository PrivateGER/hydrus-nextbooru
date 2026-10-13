"use client";

import { ArrowPathIcon, ExclamationTriangleIcon, PlayIcon, TagIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleIconSolid } from "@heroicons/react/24/solid";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InfoBox } from "@/components/ui/info-box";
import { HydrusTagServiceType } from "@/lib/hydrus/types";
import type { UseTagServicesReturn } from "@/hooks/admin/use-tag-services";

export interface TagServicesCardProps {
  tagServices: UseTagServicesReturn;
  isSyncing: boolean;
  onFullSync: () => void;
}

function TypeBadge({ label }: { label: string }) {
  return (
    <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
      {label}
    </span>
  );
}

export function TagServicesCard({ tagServices, isSyncing, onFullSync }: TagServicesCardProps) {
  const {
    status,
    isLoading,
    isSaving,
    useAll,
    setUseAll,
    selectedKeys,
    toggleService,
    includePending,
    setIncludePending,
    retry,
    saveSelection,
  } = tagServices;

  const services = status?.services ?? null;
  const allKnown = services?.find((s) => s.type === HydrusTagServiceType.AllKnownTags);
  const specificServices = services?.filter((s) => s.type !== HydrusTagServiceType.AllKnownTags) ?? [];
  const missingKeys = status?.missingKeys ?? [];
  const hasSpecificSelection = !useAll && selectedKeys.length > 0;
  const nothingSelected = !useAll && selectedKeys.length === 0;

  return (
    <Card>
      <div className="mb-3 flex items-center gap-3">
        <div className="rounded-lg bg-zinc-300 p-2 dark:bg-zinc-700">
          <TagIcon className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
        </div>
        <div>
          <h3 className="font-medium text-zinc-800 dark:text-zinc-200">Tag Services</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Choose which Hydrus tag services are imported. Changes apply on the next full sync.
          </p>
        </div>
      </div>

      {status?.pendingResync && (
        <InfoBox variant="warning" className="mb-4" title="Full sync needed">
          <p>The tag service selection changed since the last full sync. Existing posts keep their old tags until a full sync runs.</p>
          <Button onClick={onFullSync} disabled={isSyncing} variant="secondary" className="mt-2">
            <PlayIcon className="h-4 w-4" />
            Start full sync
          </Button>
        </InfoBox>
      )}

      {isLoading && !status ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <ArrowPathIcon className="h-4 w-4 animate-spin" />
          Loading tag services...
        </div>
      ) : !services ? (
        <InfoBox variant="error" title="Hydrus unreachable">
          <p>{status?.hydrusError ?? "Could not load tag services from Hydrus."}</p>
          <Button onClick={retry} loading={isLoading} variant="secondary" className="mt-2">
            {!isLoading && <ArrowPathIcon className="h-4 w-4" />}
            Retry
          </Button>
        </InfoBox>
      ) : (
        <div className="space-y-4">
          <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
            <label className={`flex items-center gap-3 px-3 py-2 text-sm ${hasSpecificSelection ? "opacity-50" : "cursor-pointer"}`}>
              <input
                type="checkbox"
                checked={useAll}
                disabled={hasSpecificSelection || isSaving}
                onChange={(event) => setUseAll(event.target.checked)}
              />
              <span className="flex-1 text-zinc-800 dark:text-zinc-200">{allKnown?.name ?? "All tag services"}</span>
              <TypeBadge label={allKnown?.typePretty ?? "everything"} />
            </label>

            {specificServices.map((service) => (
              <label
                key={service.serviceKey}
                className={`flex items-center gap-3 px-3 py-2 text-sm ${useAll ? "opacity-50" : "cursor-pointer"}`}
              >
                <input
                  type="checkbox"
                  checked={!useAll && selectedKeys.includes(service.serviceKey)}
                  disabled={useAll || isSaving}
                  onChange={() => toggleService(service.serviceKey)}
                />
                <span className="flex-1 text-zinc-800 dark:text-zinc-200">{service.name}</span>
                <TypeBadge label={service.typePretty} />
              </label>
            ))}

            {!useAll && missingKeys.filter((key) => selectedKeys.includes(key)).map((key) => (
              <label key={key} className="flex cursor-pointer items-center gap-3 bg-red-500/10 px-3 py-2 text-sm">
                <input type="checkbox" checked disabled={isSaving} onChange={() => toggleService(key)} />
                <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400" />
                <span className="min-w-0 flex-1 text-red-700 dark:text-red-300">
                  Missing service <code className="break-all text-xs">{key}</code>
                  <span className="block text-xs">Not found in Hydrus. Syncs fail until it is unchecked.</span>
                </span>
              </label>
            ))}
          </div>

          <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={includePending}
              disabled={isSaving}
              onChange={(event) => setIncludePending(event.target.checked)}
            />
            <span>
              Include pending tags
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                Also import tags queued for upload to a tag repository but not yet committed.
              </span>
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={saveSelection} loading={isSaving} disabled={isSaving || isSyncing || nothingSelected}>
              <CheckCircleIconSolid className="h-4 w-4" />
              Save
            </Button>
            {nothingSelected && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Select at least one tag service.</span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
