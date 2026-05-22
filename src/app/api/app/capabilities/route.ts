import { NextResponse, connection } from "next/server";

export async function GET() {
  if (process.env.NODE_ENV !== "test") {
    await connection();
  }

  return NextResponse.json({
    name: "hydrus-nextbooru",
    version: process.env.npm_package_version ?? null,
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
