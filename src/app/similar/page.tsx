import { Suspense } from "react";
import type { Metadata } from "next";
import { SimilarSearchResults } from "@/components/similar-search-results";
import { SimilarSearchUpload } from "@/components/similar-search-upload";

export const metadata: Metadata = {
  title: "Find Similar - Booru",
  description: "Search for visually similar images",
};

interface SimilarPageProps {
  searchParams: Promise<{ hash?: string; threshold?: string }>;
}

export default function SimilarPage({ searchParams }: SimilarPageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Find Similar Images</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Search by uploading an image or from an existing post.
        </p>
      </div>

      <Suspense fallback={<ResultsSkeleton />}>
        <SimilarPageContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SimilarPageContent({
  searchParams,
}: {
  searchParams: Promise<{ hash?: string; threshold?: string }>;
}) {
  const { hash, threshold } = await searchParams;
  const parsedThreshold = threshold ? parseInt(threshold, 10) : 10;

  return (
    <>
      <SimilarSearchUpload initialThreshold={parsedThreshold} />

      {hash && /^[a-fA-F0-9]{64}$/.test(hash) && (
        <SimilarSearchResults hash={hash} threshold={parsedThreshold} />
      )}
    </>
  );
}

function ResultsSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-10 w-full rounded-lg bg-zinc-300 dark:bg-zinc-700" />
      <div className="h-32 w-full rounded-xl bg-zinc-300 dark:bg-zinc-700" />
    </div>
  );
}
