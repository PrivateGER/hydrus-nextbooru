import { describe, it, expect, afterEach } from 'vitest';
import {
  instrumentPool,
  instrumentClient,
  startQueryCapture,
  stopQueryCapture,
  selectStatements,
  countableStatements,
  type CapturedQuery,
} from './query-capture';

/**
 * Minimal stand-in for a pg Pool and its clients. The contract
 * query-capture relies on: the pool emits 'connect' with each new client,
 * and every statement — plain pool.query or transaction-held — runs
 * through some client's `query` method.
 */
function makeFakePool(result: unknown = { rows: [] }) {
  const connectListeners: Array<(client: { query: (...args: unknown[]) => unknown }) => void> = [];
  const calls: unknown[][] = [];

  const pool = {
    on: (event: string, listener: (client: { query: (...args: unknown[]) => unknown }) => void) => {
      if (event === 'connect') connectListeners.push(listener);
      return pool;
    },
  };

  /** Simulate the pool establishing a new physical connection. */
  const connectClient = () => {
    const client = {
      query: async (...args: unknown[]) => {
        calls.push(args);
        if (result instanceof Error) throw result;
        return result;
      },
    };
    for (const listener of connectListeners) listener(client);
    return client;
  };

  return { pool, connectClient, calls };
}

afterEach(() => {
  // Ensure capture state never leaks between tests.
  stopQueryCapture();
});

describe('instrumentPool', () => {
  it('passes through results unchanged when not capturing', async () => {
    const { pool, connectClient, calls } = makeFakePool({ rows: [{ id: 1 }] });
    instrumentPool(pool);
    const client = connectClient();

    const result = await client.query('SELECT 1');
    expect(result).toEqual({ rows: [{ id: 1 }] });
    expect(calls).toHaveLength(1);
  });

  it('captures statements from every client the pool hands out', async () => {
    const { pool, connectClient } = makeFakePool();
    instrumentPool(pool);
    const first = connectClient();
    const second = connectClient();

    startQueryCapture();
    await first.query('SELECT * FROM "Post" WHERE id = $1', [42]);
    await second.query('SELECT * FROM "Tag" WHERE id = $1', [7]);
    const captured = stopQueryCapture();

    expect(captured).toEqual([
      { text: 'SELECT * FROM "Post" WHERE id = $1', values: [42] },
      { text: 'SELECT * FROM "Tag" WHERE id = $1', values: [7] },
    ]);
  });

  it('captures transaction-held statements on a checked-out client', async () => {
    // The regression this design fixes: statements between BEGIN and COMMIT
    // run on one checked-out client and must still be observed.
    const { pool, connectClient } = makeFakePool();
    instrumentPool(pool);
    const client = connectClient();

    startQueryCapture();
    await client.query('BEGIN');
    await client.query('DELETE FROM "Favorite" WHERE "postId" = $1', [1]);
    await client.query('INSERT INTO "FeedDismissal" ("postId") VALUES ($1)', [1]);
    await client.query('COMMIT');
    const captured = stopQueryCapture();

    expect(captured).toHaveLength(4);
    expect(countableStatements(captured).map((q) => q.text)).toEqual([
      'DELETE FROM "Favorite" WHERE "postId" = $1',
      'INSERT INTO "FeedDismissal" ("postId") VALUES ($1)',
    ]);
  });

  it('captures text and values for config-object calls', async () => {
    const { pool, connectClient } = makeFakePool();
    instrumentPool(pool);
    const client = connectClient();

    startQueryCapture();
    await client.query({ text: 'SELECT $1::int', values: [7] });
    const captured = stopQueryCapture();

    expect(captured).toEqual([{ text: 'SELECT $1::int', values: [7] }]);
  });

  it('defaults values to an empty array when none are provided', async () => {
    const { pool, connectClient } = makeFakePool();
    instrumentPool(pool);
    const client = connectClient();

    startQueryCapture();
    await client.query('BEGIN');
    const captured = stopQueryCapture();

    expect(captured).toEqual([{ text: 'BEGIN', values: [] }]);
  });

  it('captures the statement even when the query throws, and rethrows', async () => {
    const { pool, connectClient } = makeFakePool(new Error('connection lost'));
    instrumentPool(pool);
    const client = connectClient();

    startQueryCapture();
    await expect(client.query('SELECT 1')).rejects.toThrow('connection lost');
    const captured = stopQueryCapture();

    expect(captured).toHaveLength(1);
  });

  it('is idempotent: double instrumentation does not double-capture', async () => {
    const { pool, connectClient } = makeFakePool();
    instrumentPool(pool);
    instrumentPool(pool);
    const client = connectClient();
    // Even if a client is somehow instrumented again directly, the wrap
    // must not stack.
    instrumentClient(client);

    startQueryCapture();
    await client.query('SELECT 1');
    const captured = stopQueryCapture();

    expect(captured).toHaveLength(1);
  });

  it('stops capturing after stopQueryCapture', async () => {
    const { pool, connectClient } = makeFakePool();
    instrumentPool(pool);
    const client = connectClient();

    startQueryCapture();
    await client.query('SELECT 1');
    stopQueryCapture();
    await client.query('SELECT 2');

    startQueryCapture();
    const captured = stopQueryCapture();
    expect(captured).toEqual([]);
  });

  it('startQueryCapture resets any previously captured statements', async () => {
    const { pool, connectClient } = makeFakePool();
    instrumentPool(pool);
    const client = connectClient();

    startQueryCapture();
    await client.query('SELECT 1');
    startQueryCapture();
    await client.query('SELECT 2');
    const captured = stopQueryCapture();

    expect(captured).toHaveLength(1);
    expect(captured[0].text).toBe('SELECT 2');
  });
});

describe('statement filters', () => {
  const queries: CapturedQuery[] = [
    { text: 'BEGIN', values: [] },
    { text: 'SELECT * FROM "Post"', values: [] },
    { text: '  WITH x AS (SELECT 1) SELECT * FROM x', values: [] },
    { text: 'INSERT INTO "Tag" (name) VALUES ($1)', values: ['a'] },
    { text: 'COMMIT', values: [] },
    { text: 'ROLLBACK', values: [] },
    { text: 'SET statement_timeout = 0', values: [] },
    { text: 'DEALLOCATE s1', values: [] },
    { text: 'select lower(name) FROM "Tag"', values: [] },
  ];

  it('selectStatements keeps only SELECT/WITH statements, case-insensitively', () => {
    expect(selectStatements(queries).map((q) => q.text)).toEqual([
      'SELECT * FROM "Post"',
      '  WITH x AS (SELECT 1) SELECT * FROM x',
      'select lower(name) FROM "Tag"',
    ]);
  });

  it('countableStatements excludes transaction control and session noise', () => {
    expect(countableStatements(queries).map((q) => q.text)).toEqual([
      'SELECT * FROM "Post"',
      '  WITH x AS (SELECT 1) SELECT * FROM x',
      'INSERT INTO "Tag" (name) VALUES ($1)',
      'select lower(name) FROM "Tag"',
    ]);
  });
});
