import { afterEach, describe, expect, it, vi } from 'vitest';
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
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('describes companion API capabilities without requiring auth by default', async () => {
    const handler = await loadRoute();
    const response = await handler(new NextRequest('http://localhost/api/app/capabilities'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      name: 'hydrus-nextbooru',
      readAuthRequired: false,
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
  });

  it('requires a matching bearer token when NEXTBOORU_READ_API_KEY is configured', async () => {
    vi.stubEnv('NEXTBOORU_READ_API_KEY', 'secret-token');
    const handler = await loadRoute();

    const unauthenticated = await handler(new NextRequest('http://localhost/api/app/capabilities'));
    expect(unauthenticated.status).toBe(401);

    const wrongToken = await handler(new NextRequest('http://localhost/api/app/capabilities', {
      headers: { authorization: 'Bearer wrong-token' },
    }));
    expect(wrongToken.status).toBe(401);

    const authenticated = await handler(new NextRequest('http://localhost/api/app/capabilities', {
      headers: { authorization: 'Bearer secret-token' },
    }));
    const data = await authenticated.json();

    expect(authenticated.status).toBe(200);
    expect(data.readAuthRequired).toBe(true);
  });

  it('accepts the X-Nextbooru-Api-Key header for clients that cannot set Authorization', async () => {
    vi.stubEnv('NEXTBOORU_READ_API_KEY', 'secret-token');
    const handler = await loadRoute();

    const response = await handler(new NextRequest('http://localhost/api/app/capabilities', {
      headers: { 'x-nextbooru-api-key': 'secret-token' },
    }));

    expect(response.status).toBe(200);
  });
});
