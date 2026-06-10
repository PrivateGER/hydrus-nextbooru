import { describe, it, expect } from 'vitest';
import {
  collectPlanNodes,
  seqScannedRelations,
  indexesUsed,
  parseExplainRows,
  type ExplainJson,
} from './plan-utils';

/**
 * Fixtures mirror real `EXPLAIN (FORMAT JSON)` output shapes from PostgreSQL 18.
 * Only the fields the walker cares about are included, plus noise fields to
 * ensure unknown keys are ignored.
 */

const indexOnlyPlan: ExplainJson = [
  {
    Plan: {
      'Node Type': 'Limit',
      'Startup Cost': 0.29,
      Plans: [
        {
          'Node Type': 'Index Scan',
          'Relation Name': 'Post',
          'Index Name': 'Post_pkey',
          'Scan Direction': 'Backward',
        },
      ],
    },
  },
];

const bitmapPlan: ExplainJson = [
  {
    Plan: {
      'Node Type': 'Bitmap Heap Scan',
      'Relation Name': 'Tag',
      Plans: [
        {
          'Node Type': 'Bitmap Index Scan',
          'Index Name': 'Tag_name_trgm_idx',
          'Parent Relationship': 'Outer',
        },
      ],
    },
  },
];

const nestedSeqScanPlan: ExplainJson = [
  {
    Plan: {
      'Node Type': 'Aggregate',
      Plans: [
        {
          'Node Type': 'Nested Loop',
          Plans: [
            {
              'Node Type': 'Seq Scan',
              'Relation Name': 'PostTag',
            },
            {
              'Node Type': 'Index Scan',
              'Relation Name': 'Post',
              'Index Name': 'Post_pkey',
            },
          ],
        },
      ],
    },
  },
];

// InitPlans/SubPlans appear inside "Plans" with a Parent Relationship marker.
const initPlanWithSeqScan: ExplainJson = [
  {
    Plan: {
      'Node Type': 'Result',
      Plans: [
        {
          'Node Type': 'Seq Scan',
          'Relation Name': 'Settings',
          'Parent Relationship': 'InitPlan',
          'Subplan Name': 'InitPlan 1',
        },
        {
          'Node Type': 'Seq Scan',
          'Relation Name': 'Settings',
          'Parent Relationship': 'SubPlan',
        },
      ],
    },
  },
];

describe('collectPlanNodes', () => {
  it('flattens nested plans depth-first including the root', () => {
    const nodes = collectPlanNodes(nestedSeqScanPlan);
    expect(nodes.map((n) => n['Node Type'])).toEqual([
      'Aggregate',
      'Nested Loop',
      'Seq Scan',
      'Index Scan',
    ]);
  });

  it('walks InitPlan and SubPlan children', () => {
    const nodes = collectPlanNodes(initPlanWithSeqScan);
    expect(nodes).toHaveLength(3);
  });

  it('returns empty array for empty explain output', () => {
    expect(collectPlanNodes([])).toEqual([]);
  });

  it('handles a plan node without children', () => {
    const nodes = collectPlanNodes([
      { Plan: { 'Node Type': 'Seq Scan', 'Relation Name': 'Post' } },
    ]);
    expect(nodes).toHaveLength(1);
  });
});

describe('seqScannedRelations', () => {
  it('returns relations scanned sequentially, deduplicated', () => {
    expect(seqScannedRelations(initPlanWithSeqScan)).toEqual(['Settings']);
  });

  it('finds seq scans nested under joins', () => {
    expect(seqScannedRelations(nestedSeqScanPlan)).toEqual(['PostTag']);
  });

  it('returns empty array when only index access is used', () => {
    expect(seqScannedRelations(indexOnlyPlan)).toEqual([]);
    expect(seqScannedRelations(bitmapPlan)).toEqual([]);
  });
});

describe('indexesUsed', () => {
  it('collects index names from index, index-only and bitmap index scans', () => {
    expect(indexesUsed(indexOnlyPlan)).toEqual(['Post_pkey']);
    expect(indexesUsed(bitmapPlan)).toEqual(['Tag_name_trgm_idx']);
  });

  it('deduplicates repeated index usage', () => {
    const plan: ExplainJson = [
      {
        Plan: {
          'Node Type': 'Append',
          Plans: [
            { 'Node Type': 'Index Only Scan', 'Relation Name': 'PostTag', 'Index Name': 'PostTag_tagId_postId_idx' },
            { 'Node Type': 'Index Only Scan', 'Relation Name': 'PostTag', 'Index Name': 'PostTag_tagId_postId_idx' },
          ],
        },
      },
    ];
    expect(indexesUsed(plan)).toEqual(['PostTag_tagId_postId_idx']);
  });
});

describe('parseExplainRows', () => {
  const explainJson: ExplainJson = [
    { Plan: { 'Node Type': 'Seq Scan', 'Relation Name': 'Post' } },
  ];

  it('extracts the plan when the driver returns a parsed json object', () => {
    const rows = [{ 'QUERY PLAN': explainJson }];
    expect(parseExplainRows(rows)).toEqual(explainJson);
  });

  it('extracts the plan when the driver returns a json string', () => {
    const rows = [{ 'QUERY PLAN': JSON.stringify(explainJson) }];
    expect(parseExplainRows(rows)).toEqual(explainJson);
  });

  it('throws a descriptive error on unexpected row shapes', () => {
    expect(() => parseExplainRows([])).toThrow(/EXPLAIN/);
    expect(() => parseExplainRows([{ foo: 'bar' }])).toThrow(/EXPLAIN/);
  });
});
