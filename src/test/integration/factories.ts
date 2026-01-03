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
 * Create multiple posts with the same tag (for testing tag counts).
 * Uses bulk operations for speed.
 */
export async function createPostsWithTag(
  prisma: PrismaClient,
  tagName: string,
  count: number,
  category: TagCategory = TagCategory.GENERAL
) {
  // Create tag
  const tag = await prisma.tag.upsert({
    where: { name_category: { name: tagName, category } },
    create: { name: tagName, category, postCount: count },
    update: { postCount: { increment: count } },
  });

  // Bulk create posts and link to tag
  const postIds = await createPostsBulk(prisma, count);
  const links = postIds.map(postId => ({ postId, tagId: tag.id }));
  await linkPostsToTagsBulk(prisma, links);

  return { postIds, tag };
}

/**
 * Bulk create posts - much faster than individual creates.
 * Returns the created post IDs.
 */
export async function createPostsBulk(
  prisma: PrismaClient,
  count: number,
  overrides: Partial<{
    mimeType: string;
    extension: string;
    rating: Rating;
    width: number;
    height: number;
    fileSize: number;
  }> = {}
): Promise<number[]> {
  const baseHydrusId = randomInt(1000000);

  // Use raw SQL with RETURNING for single round-trip
  const posts = await prisma.$queryRawUnsafe<{ id: number }[]>(`
    INSERT INTO "Post" (hash, "hydrusFileId", "mimeType", extension, "fileSize", width, height, rating, "importedAt", "thumbnailStatus", "updatedAt")
    SELECT
      encode(sha256(random()::text::bytea), 'hex'),
      $1 + generate_series,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7::"Rating",
      NOW(),
      'PENDING'::"ThumbnailStatus",
      NOW()
    FROM generate_series(0, $8 - 1)
    RETURNING id
  `,
    baseHydrusId,
    overrides.mimeType ?? 'image/png',
    overrides.extension ?? '.png',
    overrides.fileSize ?? 1024,
    overrides.width ?? 800,
    overrides.height ?? 600,
    overrides.rating ?? Rating.UNRATED,
    count
  );

  return posts.map(p => p.id);
}

/**
 * Bulk create tags - much faster than individual creates.
 * Returns the created tag IDs.
 */
export async function createTagsBulk(
  prisma: PrismaClient,
  names: string[],
  category: TagCategory = TagCategory.GENERAL
): Promise<number[]> {
  if (names.length === 0) return [];

  // Build VALUES clause
  const values = names.map((_, i) => `($${i + 1}, $${names.length + 1}::"TagCategory", 0)`).join(', ');

  const tags = await prisma.$queryRawUnsafe<{ id: number }[]>(`
    INSERT INTO "Tag" (name, category, "postCount")
    VALUES ${values}
    ON CONFLICT (name, category) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `, ...names, category);

  return tags.map(t => t.id);
}

/**
 * Bulk link posts to tags - much faster than individual creates.
 * Automatically batches to stay within PostgreSQL's parameter limit.
 */
export async function linkPostsToTagsBulk(
  prisma: PrismaClient,
  links: Array<{ postId: number; tagId: number }>
): Promise<void> {
  if (links.length === 0) return;

  // PostgreSQL has ~32K parameter limit; each link uses 2 params
  // Use 10K links per batch (20K params) to stay safe
  const BATCH_SIZE = 10000;

  for (let i = 0; i < links.length; i += BATCH_SIZE) {
    const batch = links.slice(i, i + BATCH_SIZE);

    // Build VALUES clause
    const values = batch.map((_, j) => `($${j * 2 + 1}, $${j * 2 + 2})`).join(', ');
    const params = batch.flatMap(l => [l.postId, l.tagId]);

    await prisma.$executeRawUnsafe(`
      INSERT INTO "PostTag" ("postId", "tagId")
      VALUES ${values}
      ON CONFLICT DO NOTHING
    `, ...params);
  }
}

/**
 * Bulk create posts with a shared tag - optimized version.
 * Much faster than createPostsWithTag for large counts.
 */
export async function createPostsWithTagBulk(
  prisma: PrismaClient,
  tagName: string,
  count: number,
  category: TagCategory = TagCategory.GENERAL
) {
  // Create tag
  const tag = await prisma.tag.upsert({
    where: { name_category: { name: tagName, category } },
    create: { name: tagName, category, postCount: count },
    update: { postCount: { increment: count } },
  });

  // Bulk create posts
  const postIds = await createPostsBulk(prisma, count);

  // Bulk link posts to tag
  const links = postIds.map(postId => ({ postId, tagId: tag.id }));
  await linkPostsToTagsBulk(prisma, links);

  return { postIds, tag };
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
  sourceId: string,
  title?: string
) {
  return prisma.group.create({
    data: { sourceType, sourceId, title },
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

/**
 * Create a post with both tags and a note
 */
export async function createPostWithTagsAndNote(
  prisma: PrismaClient,
  tags: Array<string | { name: string; category?: TagCategory }>,
  noteOverrides: Parameters<typeof createNote>[2] = {},
  postOverrides: Parameters<typeof createPost>[1] = {}
) {
  const post = await createPostWithTags(prisma, tags, postOverrides);
  const note = await createNote(prisma, post.id, noteOverrides);
  return { post, note };
}
