import { NextRequest, NextResponse } from "next/server";
import { prisma, escapeSqlLike } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

const DEFAULT_LIMIT = 48;
const MAX_LIMIT = 100;
const MAX_PAGE = 10000;

interface NoteSearchResult {
  id: number;
  postId: number;
  name: string;
  content: string;
  headline: string | null;
  post: {
    id: number;
    hash: string;
    width: number | null;
    height: number | null;
    blurhash: string | null;
    mimeType: string;
  };
}

/**
 * Search notes by content using full-text search.
 *
 * Query parameters:
 * - `q`: search query (required, min 2 characters)
 * - `page`: page number (default 1)
 * - `limit`: results per page (default 48, max 100)
 * - `mode`: search mode - "fulltext" (default) or "partial"
 *   - fulltext: uses PostgreSQL full-text search with word matching
 *   - partial: uses ILIKE for substring matching (slower but matches partial words)
 *
 * @returns Object with:
 *   - `notes`: array of matching notes with post info and headline snippets
 *   - `totalCount`: total number of matching notes
 *   - `totalPages`: total pages available
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q")?.trim() || "";
  const mode = searchParams.get("mode") || "fulltext";
  const page = Math.min(
    MAX_PAGE,
    Math.max(1, parseInt(searchParams.get("page") || "1", 10))
  );
  const limit = Math.min(
    Math.max(1, parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10)),
    MAX_LIMIT
  );

  if (query.length < 2) {
    return NextResponse.json(
      { error: "Search query must be at least 2 characters" },
      { status: 400 }
    );
  }

  const skip = (page - 1) * limit;

  if (mode === "partial") {
    // Partial matching using ILIKE with trigram index
    const searchPattern = `%${escapeSqlLike(query)}%`;

    const [notes, totalCount] = await Promise.all([
      prisma.$queryRaw<NoteSearchResult[]>`
        SELECT
          n.id,
          n."postId",
          n.name,
          n.content,
          NULL as headline,
          jsonb_build_object(
            'id', p.id,
            'hash', p.hash,
            'width', p.width,
            'height', p.height,
            'blurhash', p.blurhash,
            'mimeType', p."mimeType"
          ) as post
        FROM "Note" n
        JOIN "Post" p ON n."postId" = p.id
        WHERE n.content ILIKE ${searchPattern}
           OR n.name ILIKE ${searchPattern}
        ORDER BY p."importedAt" DESC
        LIMIT ${limit}
        OFFSET ${skip}
      `,
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint as count
        FROM "Note" n
        WHERE n.content ILIKE ${searchPattern}
           OR n.name ILIKE ${searchPattern}
      `.then((r) => Number(r[0].count)),
    ]);

    return NextResponse.json({
      notes: notes.map((n) => ({
        ...n,
        post:
          typeof n.post === "string"
            ? JSON.parse(n.post)
            : n.post,
      })),
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    });
  }

  // Full-text search using tsvector with websearch_to_tsquery
  // This provides word-based matching with support for:
  // - Multiple words (AND by default)
  // - Quoted phrases for exact sequences
  // - OR for alternative terms
  // - - (minus) for exclusions

  const [notes, totalCount] = await Promise.all([
    prisma.$queryRaw<NoteSearchResult[]>`
      SELECT
        n.id,
        n."postId",
        n.name,
        n.content,
        ts_headline(
          'simple',
          n.content,
          websearch_to_tsquery('simple', ${query}),
          'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20, MaxFragments=2'
        ) as headline,
        jsonb_build_object(
          'id', p.id,
          'hash', p.hash,
          'width', p.width,
          'height', p.height,
          'blurhash', p.blurhash,
          'mimeType', p."mimeType"
        ) as post
      FROM "Note" n
      JOIN "Post" p ON n."postId" = p.id
      WHERE to_tsvector('simple', n.content) @@ websearch_to_tsquery('simple', ${query})
      ORDER BY ts_rank(to_tsvector('simple', n.content), websearch_to_tsquery('simple', ${query})) DESC,
               p."importedAt" DESC
      LIMIT ${limit}
      OFFSET ${skip}
    `,
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint as count
      FROM "Note" n
      WHERE to_tsvector('simple', n.content) @@ websearch_to_tsquery('simple', ${query})
    `.then((r) => Number(r[0].count)),
  ]);

  return NextResponse.json({
    notes: notes.map((n) => ({
      ...n,
      post:
        typeof n.post === "string"
          ? JSON.parse(n.post)
          : n.post,
    })),
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
  });
}
