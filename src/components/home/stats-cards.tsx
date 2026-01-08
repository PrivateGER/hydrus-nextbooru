import type { HomeStats } from "@/lib/stats";

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  subtitle?: string;
}

function StatCard({ label, value, icon, subtitle }: StatCardProps) {
  return (
    <div className="rounded-lg bg-white border border-zinc-200 dark:bg-zinc-800 dark:border-transparent p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {value.toLocaleString()}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
          {subtitle && <p className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

// SVG Icons as components
function ImageIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function PaletteIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
      />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
      />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
      />
    </svg>
  );
}

interface StatsCardsProps {
  stats: HomeStats;
  recentImports: number;
}

export function StatsCards({ stats, recentImports }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      <StatCard
        label="Posts"
        value={stats.totalPosts}
        icon={<ImageIcon />}
        subtitle={
          recentImports > 0
            ? `+${recentImports.toLocaleString()} today`
            : undefined
        }
      />
      <StatCard
        label="Artists"
        value={stats.artistCount}
        icon={<PaletteIcon />}
      />
      <StatCard
        label="Characters"
        value={stats.characterCount}
        icon={<UserIcon />}
      />
      <StatCard
        label="Series"
        value={stats.copyrightCount}
        icon={<BookmarkIcon />}
      />
      <StatCard label="Tags" value={stats.tagCount} icon={<TagIcon />} />
      <StatCard label="Groups" value={stats.groupCount} icon={<FolderIcon />} />
    </div>
  );
}
