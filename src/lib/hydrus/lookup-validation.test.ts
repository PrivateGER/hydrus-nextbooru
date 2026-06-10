import { describe, expect, it } from 'vitest';
import {
  IncompleteLookupError,
  assertLookupComplete,
} from './lookup-validation';

describe('assertLookupComplete', () => {
  it('allows a fully resolved lookup', () => {
    const entries = [
      { name: 'hair', category: 'GENERAL' },
      { name: 'alice', category: 'ARTIST' },
    ];
    const resolved = new Map([
      ['GENERAL:hair', 1],
      ['ARTIST:alice', 2],
    ]);

    expect(() =>
      assertLookupComplete(entries, resolved, (entry) => `${entry.category}:${entry.name}`, 'tag')
    ).not.toThrow();
  });

  it('throws with the missing entries when a lookup is incomplete', () => {
    const entries = [
      { name: 'hair', category: 'GENERAL' },
      { name: 'mechabare', category: 'GENERAL' },
      { name: 'alice', category: 'ARTIST' },
    ];
    const resolved = new Map([
      ['GENERAL:hair', 1],
    ]);

    expect(() =>
      assertLookupComplete(entries, resolved, (entry) => `${entry.category}:${entry.name}`, 'tag')
    ).toThrow(IncompleteLookupError);

    try {
      assertLookupComplete(entries, resolved, (entry) => `${entry.category}:${entry.name}`, 'tag');
    } catch (error) {
      expect(error).toBeInstanceOf(IncompleteLookupError);
      expect((error as IncompleteLookupError<typeof entries[number]>).missingEntries).toEqual([
        { name: 'mechabare', category: 'GENERAL' },
        { name: 'alice', category: 'ARTIST' },
      ]);
      expect((error as Error).message).toBe('Incomplete tag lookup: 2 missing of 3 entries');
    }
  });
});
