"use client";

import { TagIcon, DocumentTextIcon } from "@heroicons/react/24/outline";

export type SearchMode = "tags" | "notes";

interface ModeToggleProps {
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
}

export function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div
        role="group"
        aria-label="Search mode"
        className="inline-flex rounded-lg bg-zinc-200 dark:bg-zinc-800 p-1"
      >
        <button
          type="button"
          onClick={() => onModeChange("tags")}
          aria-pressed={mode === "tags"}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === "tags"
              ? "bg-white text-zinc-900 dark:bg-zinc-700 dark:text-white"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          }`}
          title="Search by tags"
        >
          <TagIcon className="w-4 h-4" aria-hidden="true" />
          Tags
        </button>
        <button
          type="button"
          onClick={() => onModeChange("notes")}
          aria-pressed={mode === "notes"}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === "notes"
              ? "bg-white text-zinc-900 dark:bg-zinc-700 dark:text-white"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          }`}
          title="Full-text search in notes"
        >
          <DocumentTextIcon className="w-4 h-4" aria-hidden="true" />
          Notes
        </button>
      </div>
    </div>
  );
}
