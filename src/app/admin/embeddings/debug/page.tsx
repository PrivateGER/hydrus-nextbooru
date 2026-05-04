import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getEmbeddingSettings } from "@/lib/embeddings/settings";
import { Pagination } from "@/components/pagination";

const PAGE_SIZE = 60;

interface DebugEmbeddingsPageProps {
  searchParams: Promise<{ page?: string }>;
}

interface EmbeddedPostRow {
  id: number;
  hash: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  mimeType: string;
  sourceWidth: number | null;
  sourceHeight: number | null;
  processedWidth: number | null;
  processedHeight: number | null;
  computedAt: Date | null;
}

export default function DebugEmbeddingsPage({ searchParams }: DebugEmbeddingsPageProps) {
  return (
    <Suspense fallback={<DebugEmbeddingsSkeleton />}>
      <DebugEmbeddingsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function DebugEmbeddingsContent({ searchParams }: DebugEmbeddingsPageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page || "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;
  const settings = await getEmbeddingSettings();

  const where = Prisma.sql`
    pe.model = ${settings.model}
    AND pe.dimensions = ${settings.dimensions}
    AND pe."imageMaxResolution" = ${settings.imageMaxResolution}
    AND pe.status = 'COMPLETE'::"EmbeddingStatus"
    AND pe.embedding IS NOT NULL
  `;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<EmbeddedPostRow[]>`
      SELECT
        p.id,
        p.hash,
        p.width,
        p.height,
        p.blurhash,
        p."mimeType",
        pe."sourceWidth",
        pe."sourceHeight",
        pe."processedWidth",
        pe."processedHeight",
        pe."computedAt"
      FROM "PostEmbedding" pe
      JOIN "Post" p ON p.id = pe."postId"
      WHERE ${where}
      ORDER BY pe."computedAt" DESC NULLS LAST, p.id DESC
      LIMIT ${PAGE_SIZE} OFFSET ${skip}
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count
      FROM "PostEmbedding" pe
      WHERE ${where}
    `,
  ]);

  const totalCount = Number(countRows[0]?.count ?? 0n);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Admin
            </Link>
          </div>
          <h1 className="text-2xl font-bold">Embedded Images Debug</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Showing complete embeddings for the active model, dimension, and image resolution.
          </p>
        </div>
        <div className="rounded-lg bg-zinc-100 px-3 py-2 text-right text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          <div>{settings.model}</div>
          <div>{settings.dimensions} dims / {settings.imageMaxResolution}px</div>
          <div>{totalCount.toLocaleString()} embedded</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-transparent dark:bg-zinc-800">
          <p className="text-lg text-zinc-500 dark:text-zinc-400">No embedded images for the active configuration</p>
          <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">Generate embeddings from Admin / Embeddings first.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {rows.map((post) => (
              <Link
                key={post.hash}
                href={`/post/${post.hash}`}
                className="group overflow-hidden rounded-lg border border-zinc-200 bg-white transition-colors hover:border-blue-400 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-blue-500"
              >
                <div className="relative aspect-square bg-zinc-200 dark:bg-zinc-900">
                  <Image
                    src={`/api/thumbnails/${post.hash}.webp`}
                    alt=""
                    fill
                    sizes="(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
                    className="object-contain transition-transform group-hover:scale-[1.02]"
                    unoptimized
                  />
                </div>
                <div className="space-y-1 p-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <div className="truncate font-mono text-[11px]" title={post.hash}>{post.hash}</div>
                  <div>
                    source: {formatSize(post.sourceWidth, post.sourceHeight)}
                  </div>
                  <div>
                    embedded: {formatSize(post.processedWidth, post.processedHeight)}
                  </div>
                  <div className="truncate">{post.mimeType}</div>
                </div>
              </Link>
            ))}
          </div>

          <Pagination currentPage={page} totalPages={totalPages} />
        </>
      )}
    </div>
  );
}

function DebugEmbeddingsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading embedded images">
      <div>
        <div className="mb-2 h-5 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-8 w-64 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-2 h-4 w-96 max-w-full rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
            <div className="aspect-square bg-zinc-200 dark:bg-zinc-900" />
            <div className="space-y-2 p-2">
              <div className="h-3 rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-3 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatSize(width: number | null, height: number | null): string {
  if (!width || !height) return "unknown";
  return `${width}x${height}`;
}
