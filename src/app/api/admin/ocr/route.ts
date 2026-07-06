import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth";
import {
  acquireOcrBatchLock,
  checkOcrServiceHealth,
  getOcrAdminStatus,
  isOcrEnabled,
  requestOcrBatchCancel,
  runOcrBatch,
} from "@/lib/ocr";
import { apiLog, aiLog } from "@/lib/logger";

// GET - OCR stats + batch state
export async function GET() {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  try {
    const [status, serviceReachable] = await Promise.all([
      getOcrAdminStatus(),
      checkOcrServiceHealth(),
    ]);
    return NextResponse.json({
      enabled: isOcrEnabled(),
      serviceReachable,
      ...status,
    });
  } catch (error) {
    apiLog.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to get OCR status"
    );
    return NextResponse.json({ error: "Failed to get OCR status" }, { status: 500 });
  }
}

// POST - start an OCR batch
export async function POST(request: NextRequest) {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  if (!isOcrEnabled()) {
    return NextResponse.json({ error: "OCR service is not configured" }, { status: 503 });
  }

  try {
    const parsed: unknown = await request.json().catch(() => null);
    const body: Record<string, unknown> =
      parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};

    let limit: number | undefined;
    if (body.limit !== undefined) {
      if (typeof body.limit !== "number" || !Number.isInteger(body.limit) || body.limit < 1) {
        return NextResponse.json({ error: "limit must be a positive integer" }, { status: 400 });
      }
      limit = body.limit;
    }

    let tags: string[] | undefined;
    if (body.tags !== undefined) {
      if (!Array.isArray(body.tags) || body.tags.some((t: unknown) => typeof t !== "string")) {
        return NextResponse.json({ error: "tags must be an array of strings" }, { status: 400 });
      }
      tags = body.tags;
    }

    let retryFailed: boolean | undefined;
    if (body.retryFailed !== undefined) {
      if (typeof body.retryFailed !== "boolean") {
        return NextResponse.json({ error: "retryFailed must be a boolean" }, { status: 400 });
      }
      retryFailed = body.retryFailed;
    }

    const acquired = await acquireOcrBatchLock();
    if (!acquired) {
      return NextResponse.json({ error: "An OCR batch is already running" }, { status: 409 });
    }

    // Background run; the lock is finalized inside runOcrBatch.
    runOcrBatch({ limit, tags, retryFailed })
      .then((result) => {
        aiLog.info(
          { status: result.status, processed: result.processed, failed: result.failed },
          "Background OCR batch finished"
        );
      })
      .catch((error) => {
        aiLog.error({ error: String(error) }, "Background OCR batch crashed");
      });

    return NextResponse.json({ message: "OCR batch started" }, { status: 202 });
  } catch (error) {
    apiLog.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to start OCR batch"
    );
    return NextResponse.json({ error: "Failed to start OCR batch" }, { status: 500 });
  }
}

// DELETE - cancel a running batch
export async function DELETE() {
  const auth = await verifyAdminSession();
  if (!auth.authorized) return auth.response;

  const cancelled = await requestOcrBatchCancel();
  return NextResponse.json({ cancelled });
}
