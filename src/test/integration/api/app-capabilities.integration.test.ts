import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

let GET: typeof import('@/app/api/app/capabilities/route').GET;

async function loadRoute() {
  if (!GET) {
    const routeModule = await import('@/app/api/app/capabilities/route');
    GET = routeModule.GET;
  }
  return GET;
}

describe('GET /api/app/capabilities', () => {
  it('describes public companion API capabilities', async () => {
    const handler = await loadRoute();
    const response = await handler(new NextRequest('http://localhost/api/app/capabilities'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      name: 'hydrus-nextbooru',
      endpoints: expect.objectContaining({
        postDetail: '/api/posts/{hash}',
        postSearch: '/api/posts/search',
        tagSearch: '/api/tags/search',
        thumbnail: '/api/thumbnails/{hash}.webp',
        file: '/api/files/{hash}{extension}',
        download: '/api/download/{hash}{extension}',
      }),
      features: expect.objectContaining({
        tagSearch: true,
        noteSearch: true,
        similarSearch: true,
        semanticSearch: true,
        recommendations: true,
        translations: true,
      }),
    });
    expect(data).not.toHaveProperty('readAuthRequired');
    expect(data).not.toHaveProperty('auth');
  });
});
