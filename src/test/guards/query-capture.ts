/**
 * Client-level SQL capture for guard tests.
 *
 * Every statement PrismaPg executes ultimately runs on a pg client checked
 * out of the pool: `pool.query` checks one out internally, and interactive
 * or batch `$transaction`s hold one for their duration. Instrumenting each
 * client as the pool creates it (the 'connect' event fires once per new
 * physical connection) therefore observes plain queries AND statements
 * inside transactions exactly once each. The previous hook wrapped only
 * `pool.query`, which made transaction internals invisible — an N+1 inside
 * a transaction could not trip any query budget.
 *
 * Capture state is module-global, which is safe because each guard file
 * runs in its own fork and tests within a file run sequentially.
 */

export interface CapturedQuery {
  text: string;
  values: unknown[];
}

interface QueryableClient {
  query: (...args: unknown[]) => unknown;
}

interface InstrumentablePool {
  on: (event: 'connect', listener: (client: QueryableClient) => void) => unknown;
}

const INSTRUMENTED = Symbol('query-capture-instrumented');

let capturing = false;
let captured: CapturedQuery[] = [];

/**
 * Instrument every client this pool hands out. Attach before the pool
 * serves its first query so no pre-existing connection escapes the hook.
 * Idempotent; a no-op passthrough when capture is off.
 */
export function instrumentPool(pool: InstrumentablePool): void {
  const marked = pool as InstrumentablePool & { [INSTRUMENTED]?: boolean };
  if (marked[INSTRUMENTED]) {
    return;
  }
  marked[INSTRUMENTED] = true;

  pool.on('connect', (client) => instrumentClient(client));
}

/**
 * Wrap a single client's `query` method to record statements while capture
 * is active. Idempotent per client. Exported for tests; production callers
 * go through {@link instrumentPool}.
 */
export function instrumentClient(client: QueryableClient): void {
  const marked = client as QueryableClient & { [INSTRUMENTED]?: boolean };
  if (marked[INSTRUMENTED]) {
    return;
  }
  marked[INSTRUMENTED] = true;

  const originalQuery = client.query.bind(client);
  client.query = (...args: unknown[]) => {
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
