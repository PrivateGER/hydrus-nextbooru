"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpenIcon, ArrowUturnLeftIcon } from "@heroicons/react/24/outline";
import { deserializeProgress, progressKey, readerHref } from "@/lib/reader";

interface ReadGroupButtonProps {
  groupId: number;
  postCount: number;
}

/**
 * Primary "Read" entry point for a group. Client component so it can pick up
 * saved reading progress from localStorage and offer "Continue" instead.
 * Renders the plain "Read" state on the server and only upgrades after
 * hydration, so there is no mismatch.
 */
export function ReadGroupButton({ groupId, postCount }: ReadGroupButtonProps) {
  const [resumePage, setResumePage] = useState<number | null>(null);

  // Deferred like post-grid's layout restore: reading localStorage after
  // hydration avoids a server/client mismatch, and the timeout keeps the
  // setState out of the synchronous effect body.
  useEffect(() => {
    const progress = deserializeProgress(
      localStorage.getItem(progressKey(groupId)),
      postCount
    );
    if (!progress || progress.page <= 1) return;
    const timeout = window.setTimeout(() => {
      setResumePage(progress.page);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [groupId, postCount]);

  if (postCount === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Link
        href={readerHref(groupId, resumePage ?? 1)}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
      >
        <BookOpenIcon className="h-4 w-4" />
        {resumePage !== null ? `Continue — p. ${resumePage}` : "Read"}
      </Link>
      {resumePage !== null && (
        <Link
          href={readerHref(groupId, 1)}
          className="inline-flex items-center justify-center rounded-lg bg-zinc-200 p-2 text-zinc-500 transition-colors hover:bg-zinc-300 hover:text-zinc-800 dark:bg-zinc-700/50 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
          title="Start over from page 1"
          aria-label="Start over from page 1"
        >
          <ArrowUturnLeftIcon className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
