/**
 * Shared skeleton components for loading states.
 * Used with Suspense boundaries for Cache Components compatibility.
 */

interface SkeletonProps {
  className?: string;
}

/** Base skeleton block with pulse animation */
export function Skeleton({ className }: SkeletonProps) {
  return <div className={`animate-pulse bg-zinc-800${className ? ` ${className}` : ""}`} />;
}

/** Masonry-style post grid skeleton with varied aspect ratios */
export function PostGridSkeleton({ count = 24 }: { count?: number }) {
  const aspectRatios = [1, 0.75, 1.33, 0.8, 1.2];
  return (
    <div
      className="columns-2 gap-3 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6"
      aria-busy="true"
      aria-label="Loading posts"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="mb-3 animate-pulse break-inside-avoid rounded-lg bg-zinc-800"
          style={{ aspectRatio: aspectRatios[i % aspectRatios.length] }}
        />
      ))}
    </div>
  );
}

/** Uniform grid skeleton for equal-sized items */
export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
      aria-busy="true"
      aria-label="Loading content"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="aspect-square bg-zinc-800 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

/** Search bar skeleton */
export function SearchBarSkeleton() {
  return (
    <div className="flex justify-center" aria-busy="true" aria-label="Loading search">
      <div className="w-full max-w-2xl h-12 bg-zinc-800 rounded-lg animate-pulse" />
    </div>
  );
}

/** Page header skeleton with title and count */
export function PageHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between" aria-busy="true">
      <div className="h-8 w-24 bg-zinc-800 rounded animate-pulse" />
      <div className="h-6 w-32 bg-zinc-800 rounded animate-pulse" />
    </div>
  );
}

/** Filter pills/tabs skeleton */
export function FiltersSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-wrap gap-2" aria-busy="true" aria-label="Loading filters">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-8 w-20 bg-zinc-800 rounded-full animate-pulse" />
      ))}
    </div>
  );
}

/** Tag chips skeleton */
export function TagsSkeleton({ count = 50 }: { count?: number }) {
  return (
    <div className="flex flex-wrap gap-2" aria-busy="true" aria-label="Loading tags">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-8 w-32 bg-zinc-800 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

/** Group card skeleton with header and thumbnail strip */
export function GroupCardSkeleton() {
  return (
    <div className="rounded-xl bg-zinc-800/80 p-4 border border-zinc-700/50">
      <div className="h-6 w-48 bg-zinc-700 rounded animate-pulse mb-4" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, j) => (
          <div key={j} className="h-44 w-32 bg-zinc-700 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}

/** Sidebar skeleton for tag list */
export function SidebarSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="w-64 space-y-4" aria-busy="true" aria-label="Loading sidebar">
      <div className="h-6 w-24 bg-zinc-800 rounded animate-pulse" />
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="h-6 w-full bg-zinc-800 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}

/** Media viewer skeleton */
export function MediaViewerSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading media">
      <div className="aspect-video bg-zinc-800 rounded-lg animate-pulse" />
    </div>
  );
}

/** Details card skeleton */
export function DetailsCardSkeleton() {
  return (
    <div className="rounded-lg bg-zinc-800 p-4 h-32 animate-pulse" aria-busy="true" />
  );
}
