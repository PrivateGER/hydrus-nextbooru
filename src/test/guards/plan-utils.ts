/**
 * Helpers for asserting on PostgreSQL `EXPLAIN (FORMAT JSON)` output.
 *
 * Used by the query-plan guard suite to make deterministic, CI-stable
 * assertions about index usage instead of flaky wall-clock thresholds.
 */

export interface PlanNode {
  'Node Type': string;
  'Relation Name'?: string;
  'Index Name'?: string;
  Plans?: PlanNode[];
  [key: string]: unknown;
}

/** Shape of `EXPLAIN (FORMAT JSON)` output: one entry per statement. */
export type ExplainJson = Array<{ Plan: PlanNode; [key: string]: unknown }>;

/**
 * Flatten the plan tree depth-first, including InitPlans/SubPlans
 * (PostgreSQL nests those inside `Plans` like regular children).
 */
export function collectPlanNodes(explain: ExplainJson): PlanNode[] {
  const nodes: PlanNode[] = [];

  function walk(node: PlanNode): void {
    nodes.push(node);
    for (const child of node.Plans ?? []) {
      walk(child);
    }
  }

  for (const entry of explain) {
    walk(entry.Plan);
  }

  return nodes;
}

/** Unique relation names accessed via sequential scan. */
export function seqScannedRelations(explain: ExplainJson): string[] {
  const relations = collectPlanNodes(explain)
    .filter((n) => n['Node Type'] === 'Seq Scan' && n['Relation Name'])
    .map((n) => n['Relation Name'] as string);
  return [...new Set(relations)];
}

/** Unique index names used by any index-based scan node. */
export function indexesUsed(explain: ExplainJson): string[] {
  const names = collectPlanNodes(explain)
    .filter((n) => n['Index Name'])
    .map((n) => n['Index Name'] as string);
  return [...new Set(names)];
}

/**
 * Normalize rows returned by `prisma.$queryRawUnsafe('EXPLAIN (FORMAT JSON) ...')`.
 * The driver returns one row with a "QUERY PLAN" column that may arrive as a
 * parsed object or a JSON string depending on the adapter's type mapping.
 */
export function parseExplainRows(rows: unknown): ExplainJson {
  if (Array.isArray(rows) && rows.length > 0) {
    const row = rows[0] as Record<string, unknown>;
    const value = row['QUERY PLAN'];
    if (typeof value === 'string') {
      return JSON.parse(value) as ExplainJson;
    }
    if (Array.isArray(value)) {
      return value as ExplainJson;
    }
  }
  throw new Error(
    `Unexpected EXPLAIN output shape: ${JSON.stringify(rows)?.slice(0, 200)}`
  );
}
