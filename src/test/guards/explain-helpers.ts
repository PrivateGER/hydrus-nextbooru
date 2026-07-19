/**
 * Shared capture + EXPLAIN plumbing for the plan-guard suites
 * (query-plans.guard.test.ts, search-coverage.guard.test.ts).
 */

import { expect } from 'vitest';
import { getTestPrisma } from '../integration/setup';
import {
  startQueryCapture,
  stopQueryCapture,
  selectStatements,
  type CapturedQuery,
} from './query-capture';
import { parseExplainRows, seqScannedRelations, type ExplainJson } from './plan-utils';

export interface ExplainedQuery {
  text: string;
  explain: ExplainJson;
}

/** Run `fn` with query capture active and return the recorded statements. */
export async function captureQueries(fn: () => Promise<unknown>): Promise<CapturedQuery[]> {
  startQueryCapture();
  try {
    await fn();
  } catch (err) {
    stopQueryCapture();
    throw err;
  }
  return stopQueryCapture();
}

/**
 * EXPLAIN every captured SELECT that touches the given relation.
 * Re-executes with the original parameter values so the planner produces
 * the same custom plan the application got.
 */
export async function explainSelectsTouching(
  captured: CapturedQuery[],
  relation: string
): Promise<ExplainedQuery[]> {
  const prisma = getTestPrisma();
  const seen = new Set<string>();
  const explained: ExplainedQuery[] = [];

  for (const query of selectStatements(captured)) {
    // Key on text AND values: the same statement with different bind values
    // can produce different custom plans, so each distinct execution counts.
    const key = `${query.text}|${JSON.stringify(query.values)}`;
    if (!query.text.includes(`"${relation}"`) || seen.has(key)) continue;
    seen.add(key);

    const rows = await prisma.$queryRawUnsafe(
      `EXPLAIN (FORMAT JSON) ${query.text}`,
      ...(query.values as unknown[])
    );
    explained.push({ text: query.text, explain: parseExplainRows(rows) });
  }

  return explained;
}

/**
 * Assert none of the explained queries sequentially scans the given
 * relations. Also guards against vacuous passes: at least one query must
 * have been captured and explained.
 */
export function expectNoSeqScanOn(explained: ExplainedQuery[], relations: string[]): void {
  expect(explained.length, 'no queries captured — code path likely errored').toBeGreaterThan(0);

  for (const { text, explain } of explained) {
    const offenders = seqScannedRelations(explain).filter((r) => relations.includes(r));
    expect(
      offenders,
      `Sequential scan on ${offenders.join(', ')} in query:\n${text}`
    ).toEqual([]);
  }
}
