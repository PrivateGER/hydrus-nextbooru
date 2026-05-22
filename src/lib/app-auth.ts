import { Buffer } from "node:buffer";
import { timingSafeEqual as nodeTimingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const READ_API_KEY_ENV = "NEXTBOORU_READ_API_KEY";

export interface ReadApiAuthResult {
  authorized: boolean;
  response?: NextResponse;
}

export function isReadApiAuthConfigured(): boolean {
  return Boolean(process.env[READ_API_KEY_ENV]?.trim());
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return nodeTimingSafeEqual(bufferA, bufferB);
}

function extractReadApiToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization")?.trim();
  if (authorization) {
    const bearerMatch = /^Bearer\s+(.+)$/i.exec(authorization);
    if (bearerMatch?.[1]) {
      return bearerMatch[1].trim();
    }
  }

  const headerToken = request.headers.get("x-nextbooru-api-key")?.trim();
  if (headerToken) {
    return headerToken;
  }

  return null;
}

/**
 * Verify optional read-only companion API authentication.
 *
 * If NEXTBOORU_READ_API_KEY is unset, public read endpoints remain open for
 * existing browser deployments. When configured, companion endpoints accept
 * either `Authorization: Bearer <token>` or `X-Nextbooru-Api-Key: <token>`.
 */
export function verifyReadApiAccess(request: NextRequest): ReadApiAuthResult {
  const configuredToken = process.env[READ_API_KEY_ENV]?.trim();
  if (!configuredToken) {
    return { authorized: true };
  }

  const requestToken = extractReadApiToken(request);
  if (requestToken && timingSafeEqual(requestToken, configuredToken)) {
    return { authorized: true };
  }

  return {
    authorized: false,
    response: NextResponse.json(
      { error: "Unauthorized" },
      {
        status: 401,
        headers: { "WWW-Authenticate": "Bearer" },
      }
    ),
  };
}
