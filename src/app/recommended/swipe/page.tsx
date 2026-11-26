import type { Metadata, Viewport } from "next";
import { SwipeDeck } from "@/components/swipe/swipe-deck";

export const metadata: Metadata = {
  title: "Swipe · For You - Booru",
  description: "Swipe through posts recommended from your favorites",
};

// Edge-to-edge on notched phones: the deck pads itself with safe-area insets.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Full-screen swipe mode for the "For You" feed. Static shell: the deck loads
 * its cards client-side because which cards to deal depends on the device's
 * swipe history.
 */
export default function SwipePage() {
  return <SwipeDeck />;
}
