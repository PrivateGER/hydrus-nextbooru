import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ hash: string }>;
}

const HASH_PATTERN = /^[a-fA-F0-9]{64}$/;

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { hash: rawHash } = await params;
  if (!HASH_PATTERN.test(rawHash)) {
    return NextResponse.json({ error: "Invalid hash format" }, { status: 400 });
  }

  const hash = rawHash.toLowerCase();
  const post = await prisma.post.findUnique({
    where: { hash },
    include: {
      tags: {
        include: { tag: true },
      },
      notes: {
        include: { translation: true },
        orderBy: { name: "asc" },
      },
      groups: {
        include: {
          group: {
            include: {
              translation: true,
              posts: {
                include: {
                  post: {
                    select: {
                      id: true,
                      hash: true,
                      extension: true,
                      width: true,
                      height: true,
                      blurhash: true,
                      mimeType: true,
                    },
                  },
                },
                orderBy: { position: "asc" },
              },
            },
          },
        },
        orderBy: { position: "asc" },
      },
    },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const tags = post.tags
    .map((postTag) => ({
      id: postTag.tag.id,
      name: postTag.tag.name,
      category: postTag.tag.category,
      count: postTag.tag.postCount,
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  const groups = post.groups.map((postGroup) => ({
    id: postGroup.group.id,
    sourceType: postGroup.group.sourceType,
    sourceId: postGroup.group.sourceId,
    title: postGroup.group.title,
    translation: postGroup.group.translation,
    currentPosition: postGroup.position,
    posts: postGroup.group.posts.map((groupPost) => ({
      id: groupPost.post.id,
      hash: groupPost.post.hash,
      extension: groupPost.post.extension,
      width: groupPost.post.width,
      height: groupPost.post.height,
      blurhash: groupPost.post.blurhash,
      mimeType: groupPost.post.mimeType,
      position: groupPost.position,
    })),
  }));

  let previousHash: string | null = null;
  let nextHash: string | null = null;
  let currentPosition: number | null = null;
  let totalCount: number | null = null;

  for (const group of groups) {
    if (group.posts.length <= 1) continue;

    const currentIndex = group.posts.findIndex((groupPost) => groupPost.hash === post.hash);
    if (currentIndex === -1) continue;

    previousHash = currentIndex > 0 ? group.posts[currentIndex - 1].hash : null;
    nextHash = currentIndex < group.posts.length - 1 ? group.posts[currentIndex + 1].hash : null;
    currentPosition = currentIndex + 1;
    totalCount = group.posts.length;
    break;
  }

  return NextResponse.json({
    post: {
      id: post.id,
      hydrusFileId: post.hydrusFileId,
      hash: post.hash,
      extension: post.extension,
      mimeType: post.mimeType,
      fileSize: post.fileSize,
      width: post.width,
      height: post.height,
      orientation: post.orientation,
      duration: post.duration,
      hasAudio: post.hasAudio,
      blurhash: post.blurhash,
      rating: post.rating,
      sourceUrls: post.sourceUrls,
      importedAt: post.importedAt,
      syncedAt: post.syncedAt,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      thumbnailStatus: post.thumbnailStatus,
      imageTranslation: post.imageTranslatedText
        ? {
            translatedText: post.imageTranslatedText,
            sourceLanguage: post.imageSourceLanguage,
            targetLanguage: post.imageTargetLanguage,
            translatedAt: post.imageTranslatedAt,
          }
        : null,
      tags,
      notes: post.notes,
      groups,
      navigation: {
        previousHash,
        nextHash,
        currentPosition,
        totalCount,
      },
      urls: {
        thumbnailGrid: `/api/thumbnails/${post.hash}.webp`,
        thumbnailPreview: `/api/thumbnails/${post.hash}.webp?size=preview`,
        file: `/api/files/${post.hash}${post.extension}`,
        download: `/api/download/${post.hash}${post.extension}`,
      },
    },
  });
}
