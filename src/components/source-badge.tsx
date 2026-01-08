interface SourceBadgeProps {
  sourceType: string;
}

const SOURCE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; className: string }
> = {
  PIXIV: {
    label: "Pixiv",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M4.935 0A4.924 4.924 0 0 0 0 4.935v14.13A4.924 4.924 0 0 0 4.935 24h14.13A4.924 4.924 0 0 0 24 19.065V4.935A4.924 4.924 0 0 0 19.065 0zm7.81 4.547c2.181 0 4.058.676 5.399 1.847a6.118 6.118 0 0 1 2.116 4.66c.005 1.854-.88 3.476-2.257 4.563-1.375 1.092-3.225 1.697-5.258 1.697-2.314 0-4.46-.842-4.46-.842v2.718c.397.116 1.048.365.635.779H5.79c-.41-.41.19-.656.562-.77V7.666c-.49-.113-.97-.37-.562-.77h3.15c.477.477-.172.725-.562.797v.27s1.729-.545 3.49-.545c1.39 0 2.9.35 2.9.35v-.003zm-.553 1.69c-1.648 0-2.937.752-2.937.752v7.794s1.39.584 2.937.584c3.11 0 4.617-2.396 4.617-4.675 0-2.444-1.834-4.455-4.617-4.455z" />
      </svg>
    ),
    className: "bg-[#0096fa] text-white",
  },
  TWITTER: {
    label: "Twitter",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    className: "bg-black text-white",
  },
  FANBOX: {
    label: "Fanbox",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M4.935 0A4.924 4.924 0 0 0 0 4.935v14.13A4.924 4.924 0 0 0 4.935 24h14.13A4.924 4.924 0 0 0 24 19.065V4.935A4.924 4.924 0 0 0 19.065 0zm7.81 4.547c2.181 0 4.058.676 5.399 1.847a6.118 6.118 0 0 1 2.116 4.66c.005 1.854-.88 3.476-2.257 4.563-1.375 1.092-3.225 1.697-5.258 1.697-2.314 0-4.46-.842-4.46-.842v2.718c.397.116 1.048.365.635.779H5.79c-.41-.41.19-.656.562-.77V7.666c-.49-.113-.97-.37-.562-.77h3.15c.477.477-.172.725-.562.797v.27s1.729-.545 3.49-.545c1.39 0 2.9.35 2.9.35v-.003zm-.553 1.69c-1.648 0-2.937.752-2.937.752v7.794s1.39.584 2.937.584c3.11 0 4.617-2.396 4.617-4.675 0-2.444-1.834-4.455-4.617-4.455z" />
      </svg>
    ),
    className: "bg-[#eb6f92] text-white",
  },
  TITLE: {
    label: "Collection",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
      </svg>
    ),
    className: "bg-zinc-600 text-white",
  },
  DANBOORU: {
    label: "Danbooru",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4">
        <path d="M12 2L4 7v2l8 5 8-5V7l-8-5z" fill="#a08060" />
        <path d="M4 9v8l8 5v-8L4 9z" fill="#806040" />
        <path d="M20 9l-8 5v8l8-5V9z" fill="#906850" />
      </svg>
    ),
    className: "bg-[#f90] text-white",
  },
};

export function SourceBadge({ sourceType }: SourceBadgeProps) {
  const config = SOURCE_CONFIG[sourceType];

  if (config) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.className}`}
      >
        {config.icon}
        {config.label}
      </span>
    );
  }

  // Fallback for unknown source types
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-800 dark:text-zinc-200">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="h-4 w-4"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
        />
      </svg>
      {sourceType.charAt(0) + sourceType.slice(1).toLowerCase()}
    </span>
  );
}
