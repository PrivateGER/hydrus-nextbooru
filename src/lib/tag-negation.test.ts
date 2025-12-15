import { describe, it, expect } from 'vitest';
import { parseTagsParamWithNegation } from '@/lib/wildcard';

describe('parseTagsParamWithNegation', () => {
  it('should parse regular tags as included', () => {
    const result = parseTagsParamWithNegation('tag1,tag2,tag3');
    expect(result.includeTags).toEqual(['tag1', 'tag2', 'tag3']);
    expect(result.excludeTags).toEqual([]);
  });

  it('should parse negated tags as excluded', () => {
    const result = parseTagsParamWithNegation('-tag1,-tag2');
    expect(result.includeTags).toEqual([]);
    expect(result.excludeTags).toEqual(['tag1', 'tag2']);
  });

  it('should separate included and excluded tags', () => {
    const result = parseTagsParamWithNegation('include1,-exclude1,include2,-exclude2');
    expect(result.includeTags).toEqual(['include1', 'include2']);
    expect(result.excludeTags).toEqual(['exclude1', 'exclude2']);
  });

  it('should normalize tags to lowercase', () => {
    const result = parseTagsParamWithNegation('TAG1,-TAG2');
    expect(result.includeTags).toEqual(['tag1']);
    expect(result.excludeTags).toEqual(['tag2']);
  });

  it('should trim whitespace from tags', () => {
    const result = parseTagsParamWithNegation('  tag1  ,  -tag2  ');
    expect(result.includeTags).toEqual(['tag1']);
    expect(result.excludeTags).toEqual(['tag2']);
  });

  it('should handle empty string', () => {
    const result = parseTagsParamWithNegation('');
    expect(result.includeTags).toEqual([]);
    expect(result.excludeTags).toEqual([]);
  });

  it('should filter out empty tags', () => {
    const result = parseTagsParamWithNegation('tag1,,,tag2,,');
    expect(result.includeTags).toEqual(['tag1', 'tag2']);
    expect(result.excludeTags).toEqual([]);
  });

  it('should not treat lone hyphen as negation', () => {
    // A single "-" should not be treated as negating an empty string
    const result = parseTagsParamWithNegation('-');
    expect(result.includeTags).toEqual(['-']);
    expect(result.excludeTags).toEqual([]);
  });

  it('should handle tags with spaces', () => {
    const result = parseTagsParamWithNegation('blue eyes,-red hair');
    expect(result.includeTags).toEqual(['blue eyes']);
    expect(result.excludeTags).toEqual(['red hair']);
  });

  it('should handle hyphenated tags that are not negations', () => {
    // A tag like "blue-eyes" should not be parsed as excluding "lue-eyes"
    const result = parseTagsParamWithNegation('blue-eyes,red-hair');
    expect(result.includeTags).toEqual(['blue-eyes', 'red-hair']);
    expect(result.excludeTags).toEqual([]);
  });

  it('should handle tags starting with hyphen followed by hyphen', () => {
    // Edge case: "--tag" should exclude "-tag"
    const result = parseTagsParamWithNegation('--double-hyphen');
    expect(result.includeTags).toEqual([]);
    expect(result.excludeTags).toEqual(['-double-hyphen']);
  });
});
