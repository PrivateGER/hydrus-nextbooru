import { trace, SpanStatusCode, context, type Span } from "@opentelemetry/api";

/**
 * Get the tracer for nextbooru application.
 * Uses lazy initialization to avoid issues during module loading.
 */
function getTracer() {
  return trace.getTracer("nextbooru");
}

/**
 * Wraps an async function with an OpenTelemetry span.
 * Automatically records errors and sets span status.
 *
 * @param name - The span name (e.g., "hydrus.searchFiles")
 * @param fn - The async function to trace
 * @param attributes - Optional attributes to add to the span
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  return getTracer().startActiveSpan(name, async (span) => {
    try {
      if (attributes) {
        span.setAttributes(attributes);
      }
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Wraps a sync function with an OpenTelemetry span.
 * Useful for CPU-bound operations.
 */
export function withSpanSync<T>(
  name: string,
  fn: (span: Span) => T,
  attributes?: Record<string, string | number | boolean>
): T {
  const span = getTracer().startSpan(name);
  try {
    if (attributes) {
      span.setAttributes(attributes);
    }
    const result = fn(span);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error),
    });
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Add an event to the current active span.
 * Useful for marking milestones within a traced operation.
 */
export function addSpanEvent(
  name: string,
  attributes?: Record<string, string | number | boolean>
): void {
  const currentSpan = trace.getActiveSpan();
  if (currentSpan) {
    currentSpan.addEvent(name, attributes);
  }
}

/**
 * Set attributes on the current active span.
 */
export function setSpanAttributes(
  attributes: Record<string, string | number | boolean>
): void {
  const currentSpan = trace.getActiveSpan();
  if (currentSpan) {
    currentSpan.setAttributes(attributes);
  }
}

/**
 * Get the current trace context for propagation.
 * Useful for passing context to background operations.
 */
export function getActiveContext() {
  return context.active();
}

/**
 * Run a function with a specific context.
 * Used to propagate trace context to background operations.
 */
export function runWithContext<T>(ctx: ReturnType<typeof getActiveContext>, fn: () => T): T {
  return context.with(ctx, fn);
}
