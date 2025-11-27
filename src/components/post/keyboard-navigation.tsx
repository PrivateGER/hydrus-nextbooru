"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface KeyboardNavigationProps {
  prevPostHash?: string;
  nextPostHash?: string;
}

export function KeyboardNavigation({
  prevPostHash,
  nextPostHash,
}: KeyboardNavigationProps) {
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
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
          if (prevPostHash) {
            router.push(`/post/${prevPostHash}`);
          }
          break;
        case "ArrowRight":
        case "d":
          if (nextPostHash) {
            router.push(`/post/${nextPostHash}`);
          }
          break;
        case "Escape":
          router.push("/");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevPostHash, nextPostHash, router]);

  // This component renders nothing - it only handles keyboard events
  return null;
}
