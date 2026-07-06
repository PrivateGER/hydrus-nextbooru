"use client";

import { useEffect } from "react";

/**
 * Fire-and-forget view beacon for the post detail page.
 *
 * Runs once per mount (keyed by hash), so only real opens count — SSR and
 * link prefetches never execute this effect. `keepalive` lets the request
 * finish even if the user navigates away immediately. Failures are swallowed:
 * a missed view signal is not worth surfacing to the user.
 */
export function RecordView({ hash }: { hash: string }) {
  useEffect(() => {
    fetch(`/api/posts/${hash}/view`, { method: "POST", keepalive: true }).catch(() => {});
  }, [hash]);

  return null;
}
