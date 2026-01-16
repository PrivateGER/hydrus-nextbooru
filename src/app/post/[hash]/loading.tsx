/**
 * Loading state for post pages.
 *
 * Intentionally renders nothing (returns null) to preserve the previous page
 * during navigation and reduce visual disruption when browsing posts in a gallery.
 * Next.js keeps the previous page mounted during transitions, so users see
 * the current post until the new one is ready rather than a skeleton flash.
 *
 * We can't actually delete this file because Next.js fails the build otherwise lol
 */
export default function PostLoading() {
  return null;
}
