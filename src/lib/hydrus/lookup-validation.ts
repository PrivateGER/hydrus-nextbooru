export class IncompleteLookupError<T> extends Error {
  constructor(
    readonly lookupName: string,
    readonly missingEntries: T[],
    readonly totalEntries: number
  ) {
    super(`Incomplete ${lookupName} lookup: ${missingEntries.length} missing of ${totalEntries} entries`);
    this.name = 'IncompleteLookupError';
  }
}

export function assertLookupComplete<T>(
  entries: readonly T[],
  lookup: ReadonlyMap<string, unknown>,
  getKey: (entry: T) => string,
  lookupName: string
): void {
  const missingEntries = entries.filter((entry) => !lookup.has(getKey(entry)));
  if (missingEntries.length > 0) {
    throw new IncompleteLookupError(lookupName, missingEntries, entries.length);
  }
}
