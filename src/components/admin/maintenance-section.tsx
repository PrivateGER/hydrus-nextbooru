"use client";

import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InfoBox } from "@/components/ui/info-box";

export interface MaintenanceSectionProps {
  isRecalculating: boolean;
  isSyncing: boolean;
  onRecalculateStats: () => void;
}

export function MaintenanceSection({
  isRecalculating,
  isSyncing,
  onRecalculateStats,
}: MaintenanceSectionProps) {
  return (
    <div className="space-y-5">
      <Card>
        <h3 className="mb-1 font-medium text-zinc-200">Recalculate Statistics</h3>
        <p className="mb-4 text-sm text-zinc-400">
          Update tag counts and homepage stats. Runs automatically after sync.
        </p>
        <Button
          onClick={onRecalculateStats}
          disabled={isRecalculating || isSyncing}
          loading={isRecalculating}
          variant="secondary"
        >
          <ArrowPathIcon className="h-4 w-4" />
          Recalculate
        </Button>

        <InfoBox variant="tip" className="mt-2">
          Run this if tag counts or homepage stats look incorrect.
        </InfoBox>
      </Card>
    </div>
  );
}
