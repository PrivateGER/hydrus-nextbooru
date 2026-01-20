"use client";

import { isNegatedTag, isWildcardTag, getBaseTagName } from "@/lib/tag-utils";
import { isMetaTag } from "@/lib/meta-tags-shared";

interface SelectedTagChipProps {
  tag: string;
  canToggle: boolean;
  onToggleNegation: (tag: string) => void;
  onRemove: (tag: string) => void;
}

export function SelectedTagChip({ tag, canToggle, onToggleNegation, onRemove }: SelectedTagChipProps) {
  const negated = isNegatedTag(tag);
  const wildcard = isWildcardTag(tag);
  const displayName = getBaseTagName(tag);
  const isMeta = isMetaTag(displayName);

  // Determine tag chip styling
  let chipClass = "bg-zinc-200 dark:bg-zinc-700";
  if (negated) {
    chipClass = "bg-red-100 text-red-700 border border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700";
  } else if (isMeta) {
    chipClass = "bg-cyan-100 text-cyan-700 border border-cyan-300 dark:bg-cyan-900/50 dark:text-cyan-300 dark:border-cyan-700";
  } else if (wildcard) {
    chipClass = "bg-purple-100 text-purple-700 border border-purple-300 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-700";
  }

  return (
    <span className={`flex items-center gap-1 rounded text-sm ${chipClass}`}>
      <button
        type="button"
        onClick={() => canToggle && onToggleNegation(tag)}
        className={`px-2 py-0.5 rounded-l ${canToggle ? "hover:bg-black/10 dark:hover:bg-white/10" : "cursor-default"}`}
        title={canToggle ? (negated ? "Click to include" : "Click to exclude") : "Tag filter"}
      >
        {negated && <span className="text-red-400 font-bold">-</span>}
        {isMeta && !negated && <span className="text-cyan-500 text-xs mr-1">⚙</span>}
        <span className={negated ? "line-through opacity-80" : ""}>
          {displayName}
          {wildcard && <span className="text-purple-400 ml-0.5">✱</span>}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onRemove(tag)}
        className="px-1.5 py-0.5 text-zinc-500 hover:text-zinc-900 hover:bg-black/10 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10 rounded-r"
      >
        &times;
      </button>
    </span>
  );
}
