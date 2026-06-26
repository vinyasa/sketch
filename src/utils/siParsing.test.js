import { describe, expect, it } from 'vitest';
import { extractSiMeasurement, parseSiMeasurement } from './siParsing';

describe('siParsing', () => {
  it('parses decimals, fractions, and mixed numbers', () => {
    expect(parseSiMeasurement('2.5')).toBe(2.5);
    expect(parseSiMeasurement('3/8')).toBe(0.375);
    expect(parseSiMeasurement('1 3/8')).toBe(1.375);
    expect(parseSiMeasurement('-1 1/2')).toBe(-1.5);
  });

  it('returns null for invalid measurement strings', () => {
    expect(parseSiMeasurement('abc')).toBeNull();
    expect(parseSiMeasurement('')).toBeNull();
  });

  it('extracts the first measurement token from free-form text', () => {
    expect(extractSiMeasurement('make this 1 3/8 wider')).toBe(1.375);
    expect(extractSiMeasurement('move left by -2.25 inches')).toBe(-2.25);
    expect(extractSiMeasurement('trim by 3/4')).toBe(0.75);
  });

  it('returns null when no measurement token exists', () => {
    expect(extractSiMeasurement('make it bigger')).toBeNull();
  });
});
