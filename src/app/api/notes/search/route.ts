import { NextRequest, NextResponse } from "next/server";
import { searchNotes } from "@/lib/search";

const MAX_PAGE = 10000;

/**
 * GET /api/notes/search - Search notes by content
 *
 * Full-text search across note content and translations using PostgreSQL.
 * Results are ranked by cover density (terms closer together rank higher).
 *
 * Query parameters:
 * - `q` (required): Search query, minimum 2 characters
 *   - Supports: multiple words (AND), "quoted phrases", OR, -exclusions
 * - `page` (optional): Page number, default 1, max 10000
 *
 * Response: { notes, totalCount, totalPages, queryTimeMs, error? }
 *
 * Notes with identical content share `contentHash` for client-side grouping.
 *
 * @example GET /api/notes/search?q=dragon&page=1
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q")?.trim() || "";
  const page = Math.min(
    MAX_PAGE,
    Math.max(1, parseInt(searchParams.get("page") || "1", 10))
  );

  if (query.length < 2) {
    return NextResponse.json(
      { error: "Search query must be at least 2 characters" },
      { status: 400 }
    );
  }

  const result = await searchNotes(query, page);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result);
}