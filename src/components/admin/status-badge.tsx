import {
  ArrowPathIcon,
  CheckCircleIcon,
  Cog6ToothIcon,
  ExclamationCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import type { SyncStatus } from "@/types/admin";

export interface StatusBadgeProps {
  status: SyncStatus["status"] | undefined;
}

const config = {
  running: { bg: "bg-blue-500/10", text: "text-blue-400", icon: ArrowPathIcon, label: "Syncing" },
  completed: { bg: "bg-emerald-500/10", text: "text-emerald-400", icon: CheckCircleIcon, label: "Complete" },
  error: { bg: "bg-red-500/10", text: "text-red-400", icon: XCircleIcon, label: "Failed" },
  cancelled: { bg: "bg-amber-500/10", text: "text-amber-400", icon: ExclamationCircleIcon, label: "Cancelled" },
  idle: { bg: "bg-zinc-500/10", text: "text-zinc-400", icon: Cog6ToothIcon, label: "Ready" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const { bg, text, icon: Icon, label } = config[status || "idle"];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${bg} ${text}`}>
      <Icon className={`h-3.5 w-3.5 ${status === "running" ? "animate-spin" : ""}`} />
      {label}
    </span>
  );
}
