import Link from "next/link";
import { prisma } from "@/lib/db";
import { PostCard } from "@/components/post-card";

interface SimilarSearchResultsProps {
  hash: string;
  threshold: number;
  limit?: number;
}

/**
 * Server component that fetches and renders similar image results.
 */
export async function SimilarSearchResults({
  hash,
  threshold,
  limit = 40,
}: SimilarSearchResultsProps) {
  const entry = await prisma.phashEntry.findUnique({
    where: { hash: hash.toLowerCase() },
    select: { phash: true },
  });

  if (!entry) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-800/50">
        <p className="text-zinc-500 dark:text-zinc-400">
          This post doesn&apos;t have a perceptual hash yet. Try running the hash computation from the admin panel.
        </p>
      </div>
    );
  }

  type ResultRow = {
    id: number;
    hash: string;
    width: number | null;
    height: number | null;
    blurhash: string | null;
    mimeType: string;
    distance: bigint;
  };

  const results = await prisma.$queryRaw<ResultRow[]>`
    SELECT p.id, p.hash, p.width, p.height, p.blurhash, p."mimeType",
           bit_count((pe.phash::BIT(64)) # (${entry.phash}::BIGINT::BIT(64))) AS distance
    FROM "PhashEntry" pe
    JOIN "Post" p ON p.hash = pe.hash
    WHERE pe.hash != ${hash.toLowerCase()}
      AND bit_count((pe.phash::BIT(64)) # (${entry.phash}::BIGINT::BIT(64))) <= ${threshold}
    ORDER BY distance ASC, p.id ASC
    LIMIT ${limit}
  `;

  if (results.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-800/50">
        <p className="text-zinc-500 dark:text-zinc-400">
          No similar images found within distance {threshold}. Try increasing the threshold.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {results.length} similar {results.length === 1 ? "image" : "images"}
        </h2>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          Threshold: {threshold}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {results.map((result) => (
          <div key={result.hash} className="relative">
            <PostCard
              hash={result.hash}
              width={result.width}
              height={result.height}
              blurhash={result.blurhash}
              mimeType={result.mimeType}
              layout="grid"
            />
            <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white tabular-nums">
              d={Number(result.distance)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
