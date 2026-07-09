import type { Prisma } from "@/generated/prisma/client";

/**
 * Prisma select for the fields backing {@link import("@/types/post").PostSummary} —
 * everything a thumbnail card needs. Spread and extend for routes that need
 * extra fields: `select: { ...postCardSelect, extension: true }`.
 */
export const postCardSelect = {
  id: true,
  hash: true,
  width: true,
  height: true,
  blurhash: true,
  mimeType: true,
} as const satisfies Prisma.PostSelect;
