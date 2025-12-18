import { PrismaClient, Rating, TagCategory, ThumbnailStatus, SourceType } from '@/generated/prisma/client';
import { createHash } from 'crypto';

/**
 * Generate a random 64-character hex hash
 */
export function randomHash(): string {
  return Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

/**
 * Generate a random integer
 */
export function randomInt(max = 1000000): number {
  return Math.floor(Math.random() * max);
}

/**
 * Create a post with optional overrides
 */
export async function createPost(
  prisma: PrismaClient,
  overrides: Partial<{
    hash: string;
    hydrusFileId: number;
    mimeType: string;
    extension: string;
    rating: Rating;
    width: number;
    height: number;
    fileSize: number;
    blurhash: string;
    sourceUrls: string[];
    thumbnailStatus: ThumbnailStatus;
  }> = {}
) {
  return prisma.post.create({
    data: {
      hash: overrides.hash ?? randomHash(),
      hydrusFileId: overrides.hydrusFileId ?? randomInt(),
      mimeType: overrides.mimeType ?? 'image/png',
      extension: overrides.extension ?? '.png',
      fileSize: overrides.fileSize ?? 1024,
      width: overrides.width ?? 800,
      height: overrides.height ?? 600,
      rating: overrides.rating ?? Rating.UNRATED,
      importedAt: new Date(),
      blurhash: overrides.blurhash,
      sourceUrls: overrides.sourceUrls ?? [],
      thumbnailStatus: overrides.thumbnailStatus ?? ThumbnailStatus.PENDING,
    },
  });
}

/**
 * Create a tag with optional category
 */
export async function createTag(
  prisma: PrismaClient,
  name: string,
  category: TagCategory = TagCategory.GENERAL
) {
  return prisma.tag.create({
    data: { name, category, postCount: 0 },
  });
}

/**
 * Create a post with associated tags
 */
export async function createPostWithTags(
  prisma: PrismaClient,
  tags: Array<string | { name: string; category?: TagCategory }>,
  postOverrides: Parameters<typeof createPost>[1] = {}
) {
  const post = await createPost(prisma, postOverrides);

  for (const tagInput of tags) {
    const name = typeof tagInput === 'string' ? tagInput : tagInput.name;
    const category = typeof tagInput === 'string' ? TagCategory.GENERAL : (tagInput.category ?? TagCategory.GENERAL);

    // Upsert tag to handle duplicates
    const tag = await prisma.tag.upsert({
      where: { name_category: { name, category } },
      create: { name, category, postCount: 1 },
      update: { postCount: { increment: 1 } },
    });

    await prisma.postTag.create({
      data: { postId: post.id, tagId: tag.id },
    });
  }

  return post;
}

/**
 * Create multiple posts with the same tags (for testing tag counts)
 */
export async function createPostsWithTag(
  prisma: PrismaClient,
  tagName: string,
  count: number,
  category: TagCategory = TagCategory.GENERAL
) {
  const posts = [];

  // Create tag once
  const tag = await prisma.tag.upsert({
    where: { name_category: { name: tagName, category } },
    create: { name: tagName, category, postCount: count },
    update: { postCount: { increment: count } },
  });

  for (let i = 0; i < count; i++) {
    const post = await createPost(prisma);
    await prisma.postTag.create({
      data: { postId: post.id, tagId: tag.id },
    });
    posts.push(post);
  }

  return { posts, tag };
}

/**
 * Create a sync state record
 */
export async function createSyncState(
  prisma: PrismaClient,
  status: 'idle' | 'running' | 'completed' | 'error' | 'cancelled' = 'idle',
  overrides: Partial<{
    lastSyncedAt: Date;
    lastSyncCount: number;
    errorMessage: string;
    totalFiles: number;
    processedFiles: number;
    currentBatch: number;
    totalBatches: number;
  }> = {}
) {
  return prisma.syncState.create({
    data: {
      status,
      lastSyncedAt: overrides.lastSyncedAt,
      lastSyncCount: overrides.lastSyncCount ?? 0,
      errorMessage: overrides.errorMessage,
      totalFiles: overrides.totalFiles ?? 0,
      processedFiles: overrides.processedFiles ?? 0,
      currentBatch: overrides.currentBatch ?? 0,
      totalBatches: overrides.totalBatches ?? 0,
    },
  });
}

/**
 * Create a group (for Pixiv/Twitter grouping)
 */
export async function createGroup(
  prisma: PrismaClient,
  sourceType: SourceType,
  sourceId: string
) {
  return prisma.group.create({
    data: { sourceType, sourceId },
  });
}

/**
 * Create a post and add it to a group
 */
export async function createPostInGroup(
  prisma: PrismaClient,
  group: { id: number },
  position: number = 0,
  postOverrides: Parameters<typeof createPost>[1] = {}
) {
  const post = await createPost(prisma, postOverrides);

  await prisma.postGroup.create({
    data: {
      postId: post.id,
      groupId: group.id,
      position,
    },
  });

  return post;
}

/**
 * Compute SHA256 hash of content (matches PostgreSQL's encode(digest(content, 'sha256'), 'hex'))
 */
function computeContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Create a note attached to a post.
 * If translation fields are provided, a NoteTranslation record is also created.
 */
export async function createNote(
  prisma: PrismaClient,
  postId: number,
  overrides: Partial<{
    name: string;
    content: string;
    translatedContent: string;
    sourceLanguage: string;
    targetLanguage: string;
  }> = {}
) {
  const content = overrides.content ?? 'Default note content';

  // Create the note (contentHash is auto-generated by PostgreSQL)
  const note = await prisma.note.create({
    data: {
      postId,
      name: overrides.name ?? 'Note',
      content,
    },
  });

  // If translation is provided, create/upsert the NoteTranslation record
  if (overrides.translatedContent) {
    const contentHash = computeContentHash(content);
    await prisma.noteTranslation.upsert({
      where: { contentHash },
      create: {
        contentHash,
        translatedContent: overrides.translatedContent,
        sourceLanguage: overrides.sourceLanguage ?? null,
        targetLanguage: overrides.targetLanguage ?? null,
      },
      update: {
        translatedContent: overrides.translatedContent,
        sourceLanguage: overrides.sourceLanguage ?? null,
        targetLanguage: overrides.targetLanguage ?? null,
      },
    });
  }

  return note;
}

/**
 * Create a post with a note
 */
export async function createPostWithNote(
  prisma: PrismaClient,
  noteOverrides: Parameters<typeof createNote>[2] = {},
  postOverrides: Parameters<typeof createPost>[1] = {}
) {
  const post = await createPost(prisma, postOverrides);
  const note = await createNote(prisma, post.id, noteOverrides);
  return { post, note };
}
