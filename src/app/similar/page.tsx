import type { Metadata } from "next";
import { SimilarSearch } from "@/components/similar-search";

export const metadata: Metadata = {
  title: "Reverse Search - Booru",
  description: "Find matching images by perceptual hash",
};

interface SimilarPageProps {
  searchParams: Promise<{ hash?: string; threshold?: string }>;
}

export default async function SimilarPage({ searchParams }: SimilarPageProps) {
  const { hash, threshold } = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reverse Image Search</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Upload an image or search from an existing post to find matches.
        </p>
      </div>

      <SimilarSearch
        initialHash={hash}
        initialThreshold={threshold ? parseInt(threshold, 10) : 10}
      />
    </div>
  );
}
