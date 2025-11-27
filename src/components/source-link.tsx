import { SourceType } from "@/generated/prisma/client";
import type { DisplaySource } from "@/lib/hydrus/url-parser";

// Source icons as inline SVGs
function PixivIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.935 0A4.924 4.924 0 0 0 0 4.935v14.13A4.924 4.924 0 0 0 4.935 24h14.13A4.924 4.924 0 0 0 24 19.065V4.935A4.924 4.924 0 0 0 19.065 0zm7.81 4.547c2.181 0 4.058.676 5.399 1.847a6.118 6.118 0 0 1 2.116 4.66c.005 1.854-.88 3.476-2.257 4.563-1.375 1.092-3.225 1.697-5.258 1.697-2.314 0-4.46-.842-4.46-.842v2.718c.397.116 1.048.365.635.779H5.79c-.41-.41.19-.663.644-.779V7.666c-1.053.81-1.593 1.51-1.868 2.031.32 1.02-.284.969-.284.969l-1.09-1.665s3.868-4.454 9.553-4.454zm-.19 1.754c-.98 0-2.16.253-3.302.81v6.891c.818.453 1.879.804 3.263.804 2.123 0 3.778-1.136 3.778-4.292 0-2.604-1.4-4.213-3.739-4.213z" />
    </svg>
  );
}

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function DeviantArtIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.207 4.794l.23-.43V0H15.07l-.436.44-2.058 3.925-.646.436H4.58v5.39h4.04l.36.436-4.4 8.397-.36.404v4.572h4.376l.436-.442 2.058-3.923.646-.436h7.39v-5.39h-4.04l-.36-.436 4.4-8.397z" />
    </svg>
  );
}

function DanbooruIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor">D</text>
    </svg>
  );
}

function GelbooruIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor">G</text>
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}

function getSourceIcon(type: SourceType | null) {
  switch (type) {
    case SourceType.PIXIV:
      return PixivIcon;
    case SourceType.TWITTER:
      return TwitterIcon;
    case SourceType.DEVIANTART:
      return DeviantArtIcon;
    case SourceType.DANBOORU:
      return DanbooruIcon;
    case SourceType.GELBOORU:
      return GelbooruIcon;
    default:
      return LinkIcon;
  }
}

function getSourceColor(type: SourceType | null): string {
  switch (type) {
    case SourceType.PIXIV:
      return "text-[#0096fa] hover:text-[#00b4ff]";
    case SourceType.TWITTER:
      return "text-zinc-100 hover:text-white";
    case SourceType.DEVIANTART:
      return "text-[#00e59b] hover:text-[#00ffab]";
    case SourceType.DANBOORU:
      return "text-[#0075f8] hover:text-[#3d9bff]";
    case SourceType.GELBOORU:
      return "text-[#006ffa] hover:text-[#3d9bff]";
    default:
      return "text-blue-400 hover:text-blue-300";
  }
}

interface SourceLinkProps {
  source: DisplaySource;
}

export function SourceLink({ source }: SourceLinkProps) {
  const Icon = getSourceIcon(source.type);
  const colorClass = getSourceColor(source.type);

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 ${colorClass} transition-colors`}
      title={source.url}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{source.label}</span>
    </a>
  );
}
