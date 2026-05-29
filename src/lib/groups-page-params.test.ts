import { describe, expect, it } from 'vitest';
import { SourceType } from '@/generated/prisma/client';

import { parseGroupsPageParams } from './groups-page-params';

describe('parseGroupsPageParams', () => {
  it('normalizes valid groups page parameters', () => {
    const result = parseGroupsPageParams({
      type: SourceType.PIXIV,
      order: 'oldest',
      page: '3',
      seed: 'abc123',
      q: '  anthology  ',
      creator: '  studio_artist  ',
    });

    expect(result).toEqual({
      typeFilter: SourceType.PIXIV,
      order: 'oldest',
      page: 3,
      seed: 'abc123',
      query: 'anthology',
      creatorFilter: 'studio_artist',
    });
  });

  it('falls back for invalid enum values, invalid pages, and blank text filters', () => {
    const result = parseGroupsPageParams({
      type: 'NOT_A_SOURCE',
      order: 'sideways',
      page: '-4',
      seed: 'seed-value',
      q: '   ',
      creator: '\t',
    });

    expect(result).toEqual({
      typeFilter: undefined,
      order: 'random',
      page: 1,
      seed: 'seed-value',
      query: '',
      creatorFilter: '',
    });
  });
});
