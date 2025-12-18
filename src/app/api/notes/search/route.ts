import { NextRequest, NextResponse } from "next/server";
import { searchNotes } from "@/lib/search";

const MAX_PAGE = 10000;

/**
 * Search notes by content using full-text search.
 *
 * Query parameters:
 * - `q`: search query (required, min 2 characters)
 * - `page`: page number (default 1)
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