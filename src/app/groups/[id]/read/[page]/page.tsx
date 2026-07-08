import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { MangaReader } from "@/components/reader/manga-reader";
import { clampPage, parsePageParam, readerHref } from "@/lib/reader";

interface ReaderPageProps {
  params: Promise<{ id: string; page: string }>;
}

/** Full-screen black shell so entering the reader never flashes the app UI. */
function ReaderSkeleton() {
  return (
    <div
      className="fixed inset-0 z-[60] bg-black"
      style={{ height: "100dvh" }}
      aria-busy="true"
      aria-label="Loading reader"
    />
  );
}

function groupDisplayTitle(group: {
  title: string | null;
  sourceType: string;
  sourceId: string;
  translation: { translatedContent: string } | null;
}): string {
  return (
    group.translation?.translatedContent ||
    group.title ||
    `${group.sourceType} ${group.sourceId}`
  );
}

export async function generateMetadata({ params }: ReaderPageProps): Promise<Metadata> {
  const { id, page } = await params;
  const groupId = parseInt(id, 10);
  if (isNaN(groupId)) return { title: "Not Found - Booru" };

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      title: true,
      sourceType: true,
      sourceId: true,
      memberCount: true,
      translation: { select: { translatedContent: true } },
    },
  });
  if (!group) return { title: "Not Found - Booru" };

  return {
    title: `${groupDisplayTitle(group)} · ${page}/${group.memberCount} - Booru`,
    // Reader pages are transient viewing state; don't index them.
    robots: { index: false },
  };
}

/**
 * E-hentai style reader for a group. The page segment is a 1-based ordinal
 * into the group's members ordered by (position, postId) — NOT the raw
 * Hydrus position value, which can be sparse or duplicated.
 *
 * Out-of-range page numbers redirect to the nearest valid page so shared
 * links keep working when group membership changes.
 */
export default function GroupReaderPage({ params }: ReaderPageProps) {
  return (
    <Suspense fallback={<ReaderSkeleton />}>
      <GroupReaderContent params={params} />
    </Suspense>
  );
}

async function GroupReaderContent({ params }: ReaderPageProps) {
  const { id, page: rawPage } = await params;

  const groupId = parseInt(id, 10);
  if (isNaN(groupId)) notFound();

  const requestedPage = parsePageParam(rawPage);
  if (requestedPage === null) notFound();

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      title: true,
      sourceType: true,
      sourceId: true,
      translation: { select: { translatedContent: true } },
      posts: {
        select: {
          post: {
            select: {
              hash: true,
              width: true,
              height: true,
              blurhash: true,
              mimeType: true,
              extension: true,
            },
          },
        },
        // Same ordering as the group page and post-page filmstrips.
        orderBy: [{ position: "asc" }, { postId: "asc" }],
      },
    },
  });

  if (!group) notFound();
  if (group.posts.length === 0) redirect(`/groups/${group.id}`);

  const page = clampPage(requestedPage, group.posts.length);
  if (page !== requestedPage) redirect(readerHref(group.id, page));

  return (
    <MangaReader
      groupId={group.id}
      title={groupDisplayTitle(group)}
      pages={group.posts.map((pg) => pg.post)}
      initialPage={page}
    />
  );
}
