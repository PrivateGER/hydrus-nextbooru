/**
 * Loading state for post pages.
 *
 * Uses a minimal loading indicator instead of a full skeleton to reduce
 * visual disruption when navigating between posts in a gallery.
 * The previous post remains visible in the background while this loads.
 */
export default function PostLoading() {
  // Return null to minimize visual disruption during navigation.
  // The previous page content remains visible while the new page loads.
  // This works because Next.js keeps the previous page mounted during transitions.
  return null;
}
