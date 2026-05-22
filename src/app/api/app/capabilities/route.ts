import { NextRequest, NextResponse, connection } from "next/server";
import { isReadApiAuthConfigured, verifyReadApiAccess } from "@/lib/app-auth";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "test") {
    await connection();
  }
  const auth = verifyReadApiAccess(request);
  if (!auth.authorized) return auth.response;

  return NextResponse.json({
    name: "hydrus-nextbooru",
    version: process.env.npm_package_version ?? null,
    readAuthRequired: isReadApiAuthConfigured(),
    auth: {
      bearer: true,
      header: "X-Nextbooru-Api-Key",
    },
    endpoints: {
      capabilities: "/api/app/capabilities",
      postSearch: "/api/posts/search",
      postDetail: "/api/posts/{hash}",
      semanticSearch: "/api/posts/semantic-search",
      tagSearch: "/api/tags/search",
      tags: "/api/tags",
      tagTree: "/api/tags/tree",
      noteSearch: "/api/notes/search",
      similarSearch: "/api/similar",
      recommendations: "/api/recommendations/{hash}",
      thumbnail: "/api/thumbnails/{hash}.webp",
      file: "/api/files/{hash}{extension}",
      download: "/api/download/{hash}{extension}",
    },
    features: {
      tagSearch: true,
      noteSearch: true,
      similarSearch: true,
      semanticSearch: true,
      recommendations: true,
      translations: true,
      groupedPosts: true,
      blurhash: true,
      animatedThumbnails: true,
      rangeRequests: true,
    },
  });
}
