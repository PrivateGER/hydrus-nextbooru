import { describe, it, expect, afterEach } from 'vitest';
import {
  instrumentPool,
  startQueryCapture,
  stopQueryCapture,
  selectStatements,
  countableStatements,
  type CapturedQuery,
} from './query-capture';

/**
 * Minimal stand-in for a pg Pool: the only contract query-capture relies on
 * is the `query` method, which PrismaPg drives for every statement.
 */
function makeFakePool(result: unknown = { rows: [] }) {
  const calls: unknown[][] = [];
  return {
    calls,
    query: async (...args: unknown[]) => {
      calls.push(args);
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

afterEach(() => {
  // Ensure capture state never leaks between tests.
  stopQueryCapture();
});

describe('instrumentPool', () => {
  it('passes through results unchanged when not capturing', async () => {
    const pool = makeFakePool({ rows: [{ id: 1 }] });
    instrumentPool(pool);

    const result = await pool.query('SELECT 1');
    expect(result).toEqual({ rows: [{ id: 1 }] });
    expect(pool.calls).toHaveLength(1);
  });

  it('captures text and values for string-form calls', async () => {
    const pool = makeFakePool();
    instrumentPool(pool);

    startQueryCapture();
    await pool.query('SELECT * FROM "Post" WHERE id = $1', [42]);
    const captured = stopQueryCapture();

    expect(captured).toEqual([
      { text: 'SELECT * FROM "Post" WHERE id = $1', values: [42] },
    ]);
  });

  it('captures text and values for config-object calls', async () => {
    const pool = makeFakePool();
    instrumentPool(pool);

    startQueryCapture();
    await pool.query({ text: 'SELECT $1::int', values: [7] });
    const captured = stopQueryCapture();

    expect(captured).toEqual([{ text: 'SELECT $1::int', values: [7] }]);
  });

  it('defaults values to an empty array when none are provided', async () => {
    const pool = makeFakePool();
    instrumentPool(pool);

    startQueryCapture();
    await pool.query('BEGIN');
    const captured = stopQueryCapture();

    expect(captured).toEqual([{ text: 'BEGIN', values: [] }]);
  });

  it('captures the statement even when the query throws, and rethrows', async () => {
    const pool = makeFakePool(new Error('connection lost'));
    instrumentPool(pool);

    startQueryCapture();
    await expect(pool.query('SELECT 1')).rejects.toThrow('connection lost');
    const captured = stopQueryCapture();

    expect(captured).toHaveLength(1);
  });

  it('is idempotent: double instrumentation does not double-capture', async () => {
    const pool = makeFakePool();
    instrumentPool(pool);
    instrumentPool(pool);

    startQueryCapture();
    await pool.query('SELECT 1');
    const captured = stopQueryCapture();

    expect(captured).toHaveLength(1);
  });

  it('stops capturing after stopQueryCapture', async () => {
    const pool = makeFakePool();
    instrumentPool(pool);

    startQueryCapture();
    await pool.query('SELECT 1');
    stopQueryCapture();
    await pool.query('SELECT 2');

    startQueryCapture();
    const captured = stopQueryCapture();
    expect(captured).toEqual([]);
  });

  it('startQueryCapture resets any previously captured statements', async () => {
    const pool = makeFakePool();
    instrumentPool(pool);

    startQueryCapture();
    await pool.query('SELECT 1');
    startQueryCapture();
    await pool.query('SELECT 2');
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
