"use client";

import { useEffect } from "react";

/**
 * Global safety net: pause any video that plays while not visible.
 *
 * With cacheComponents, navigated-away pages stay mounted in a hidden
 * <Activity>, so their <video> elements survive navigation. The media viewer
 * pauses its own video on hide, but browser-initiated playback (late
 * buffering, effect replays on cache restores, engine-specific view
 * transition timing) can still start audio from an offscreen page. This
 * capture-phase listener catches every `play` event in the document and
 * pauses the element unless it is actually visible, closing the whole class
 * of "audio keeps playing from a page I left" bugs regardless of trigger.
 *
 * checkVisibility() accounts for display:none ancestors (hidden Activity
 * pages) while staying true for position:fixed overlays like the reader.
 * Browsers without it (pre-2023) just keep the media viewer's own handling.
 *
 * Mounted once in the root layout; renders nothing.
 */
export function PauseHiddenVideos() {
  useEffect(() => {
    const onPlay = (event: Event) => {
      const video = event.target;
      if (!(video instanceof HTMLVideoElement)) return;
      if (typeof video.checkVisibility !== "function") return;
      if (!video.checkVisibility()) {
        video.pause();
      }
    };

    document.addEventListener("play", onPlay, true);
    return () => document.removeEventListener("play", onPlay, true);
  }, []);

  return null;
}
