export function validateEmbeddingVector(values: number[], expectedDimensions: number): number[] {
  if (!Array.isArray(values)) {
    throw new TypeError("Embedding must be an array");
  }

  if (values.length !== expectedDimensions) {
    throw new RangeError(`Expected ${expectedDimensions} embedding dimensions, got ${values.length}`);
  }

  for (const value of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new TypeError("Embedding contains a non-finite value");
    }
  }

  return values;
}

export function toVectorLiteral(values: number[]): string {
  return `[${values.map((value) => Number(value).toString()).join(",")}]`;
}

export function parseVectorLiteral(value: string): number[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new TypeError("Vector literal must parse to an array");
  }

  return parsed.map((entry) => {
    if (typeof entry !== "number" || !Number.isFinite(entry)) {
      throw new TypeError("Vector literal contains a non-finite value");
    }
    return entry;
  });
}
