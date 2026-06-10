/**
 * Pool-level SQL capture for guard tests.
 *
 * PrismaPg drives every statement through `pool.query` (the same fact
 * src/lib/db.ts relies on for tracing), so wrapping it lets guard tests
 * record the exact SQL + parameter values an API route executes — for
 * re-running under EXPLAIN and for N+1 query-count budgets.
 *
 * Capture state is module-global, which is safe because each guard file
 * runs in its own fork and tests within a file run sequentially.
 */

export interface CapturedQuery {
  text: string;
  values: unknown[];
}

interface QueryablePool {
  query: (...args: unknown[]) => unknown;
}

const INSTRUMENTED = Symbol('query-capture-instrumented');

let capturing = false;
let captured: CapturedQuery[] = [];

/**
 * Wrap a pool's `query` method to record statements while capture is active.
 * Idempotent; a no-op passthrough when capture is off.
 */
export function instrumentPool(pool: QueryablePool): void {
  const marked = pool as QueryablePool & { [INSTRUMENTED]?: boolean };
  if (marked[INSTRUMENTED]) {
    return;
  }
  marked[INSTRUMENTED] = true;

  const originalQuery = pool.query.bind(pool);
  pool.query = (...args: unknown[]) => {
    if (capturing) {
      const first = args[0];
      const text =
        typeof first === 'string'
          ? first
          : String((first as { text?: unknown })?.text ?? '');
      const values =
        typeof first === 'string'
          ? Array.isArray(args[1])
            ? (args[1] as unknown[])
            : []
          : Array.isArray((first as { values?: unknown })?.values)
            ? ((first as { values: unknown[] }).values)
            : [];
      captured.push({ text, values });
    }
    return originalQuery(...args);
  };
}

/** Begin recording statements; discards anything captured earlier. */
export function startQueryCapture(): void {
  capturing = true;
  captured = [];
}

/** Stop recording and return everything captured since start. */
export function stopQueryCapture(): CapturedQuery[] {
  capturing = false;
  const result = captured;
  captured = [];
  return result;
}

const NON_COUNTABLE = /^\s*(BEGIN|COMMIT|ROLLBACK|SET|DEALLOCATE|SAVEPOINT|RELEASE)\b/i;
const SELECT_LIKE = /^\s*(SELECT|WITH)\b/i;

/** Statements that read data — candidates for EXPLAIN plan assertions. */
export function selectStatements(queries: CapturedQuery[]): CapturedQuery[] {
  return queries.filter((q) => SELECT_LIKE.test(q.text));
}

/**
 * Statements that count toward a request's query budget: everything except
 * transaction control and session-level noise the driver emits.
 */
export function countableStatements(queries: CapturedQuery[]): CapturedQuery[] {
  return queries.filter((q) => !NON_COUNTABLE.test(q.text));
}
