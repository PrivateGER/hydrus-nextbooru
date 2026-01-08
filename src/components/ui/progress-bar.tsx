export interface ProgressBarProps {
  current: number;
  total: number;
  color?: "blue" | "purple";
}

export function ProgressBar({ current, total, color = "blue" }: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  const colorClass = color === "purple" ? "bg-purple-500" : "bg-blue-500";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{percentage}%</span>
        <span className="tabular-nums text-zinc-500">
          {current.toLocaleString()} / {total.toLocaleString()}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-300 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
