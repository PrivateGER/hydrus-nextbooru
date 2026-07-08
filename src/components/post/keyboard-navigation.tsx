"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface KeyboardNavigationProps {
  /** Full destination URL for the previous post (may carry ?in= group context). */
  prevUrl?: string;
  /** Full destination URL for the next post (may carry ?in= group context). */
  nextUrl?: string;
}

export function KeyboardNavigation({
  prevUrl,
  nextUrl,
}: KeyboardNavigationProps) {
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or contenteditable element
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      // Don't trigger if video is focused (let video handle its own keys)
      if (e.target instanceof HTMLVideoElement) {
        return;
      }

      switch (e.key) {
        case "ArrowLeft":
        case "a":
          if (prevUrl) {
            router.push(prevUrl);
          }
          break;
        case "ArrowRight":
        case "d":
          if (nextUrl) {
            router.push(nextUrl);
          }
          break;
        case "Escape":
          router.push("/");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevUrl, nextUrl, router]);

  // This component renders nothing - it only handles keyboard events
  return null;
}
