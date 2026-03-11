import type { Metadata } from "next";
import { SimilarSearch } from "@/components/similar-search";

export const metadata: Metadata = {
  title: "Find Similar - Booru",
  description: "Search for visually similar images",
};

interface SimilarPageProps {
  searchParams: Promise<{ hash?: string; threshold?: string }>;
}

export default async function SimilarPage({ searchParams }: SimilarPageProps) {
  const { hash, threshold } = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Find Similar Images</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Search by uploading an image or from an existing post.
        </p>
      </div>

      <SimilarSearch
        initialHash={hash}
        initialThreshold={threshold ? parseInt(threshold, 10) : 10}
      />
    </div>
  );
}
