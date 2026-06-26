import { describe, expect, it } from 'vitest';
import {
  formatUnit,
  getGridStep,
  parseFraction,
  parseNum,
  toDisplay,
  toImperial,
} from './units';

describe('units', () => {
  describe('formatUnit', () => {
    it('formats metric values in millimeters', () => {
      expect(formatUnit(1, 'metric')).toBe('25.4mm');
    });

    it('formats imperial decimal values when decimal mode is requested', () => {
      expect(formatUnit(1.375, 'imperial', 'decimal')).toBe('1.375"');
    });

    it('formats imperial fraction values in simplified form', () => {
      expect(formatUnit(1.5, 'imperial')).toBe('1 1/2"');
      expect(formatUnit(0.75, 'imperial')).toBe('3/4"');
    });

    it('uses approximation prefix when rounding to 1/16 creates visible deviation', () => {
      expect(formatUnit(1.2, 'imperial')).toBe('≈ 1 3/16"');
    });
  });

  describe('getGridStep', () => {
    it('returns 0 when snapping is off', () => {
      expect(getGridStep('off', 'imperial')).toBe(0);
      expect(getGridStep('off', 'metric')).toBe(0);
    });

    it('returns the expected imperial grid increments', () => {
      expect(getGridStep('1/8 in', 'imperial')).toBe(0.125);
      expect(getGridStep('1 in', 'imperial')).toBe(1);
    });

    it('returns the expected metric grid increments converted to inches', () => {
      expect(getGridStep('10 mm', 'metric')).toBeCloseTo(10 / 25.4);
      expect(getGridStep('5 mm', 'imperial')).toBeCloseTo(5 / 25.4);
    });
  });

  describe('unit conversions', () => {
    it('converts metric display values to internal imperial inches', () => {
      expect(toImperial(25.4, 'metric')).toBeCloseTo(1);
    });

    it('converts internal imperial inches to metric display values', () => {
      expect(toDisplay(1, 'metric')).toBeCloseTo(25.4);
    });

    it('returns 0 for invalid conversion inputs', () => {
      expect(toImperial('abc', 'imperial')).toBe(0);
      expect(toDisplay('abc', 'metric')).toBe(0);
    });
  });

  describe('parseFraction', () => {
    it('parses decimal strings', () => {
      expect(parseFraction('1.25')).toBe(1.25);
    });

    it('parses fractional strings', () => {
      expect(parseFraction('3/4')).toBe(0.75);
      expect(parseFraction('1 1/2')).toBe(1.5);
      expect(parseFraction('1-1/2')).toBe(1.5);
    });

    it('strips inch/unit markers before parsing', () => {
      expect(parseFraction('1 1/2"')).toBe(1.5);
      expect(parseFraction('3/4 in')).toBe(0.75);
    });

    it('returns NaN when parsing fails', () => {
      expect(Number.isNaN(parseFraction('abc'))).toBe(true);
      expect(Number.isNaN(parseFraction(''))).toBe(true);
    });
  });

  describe('parseNum', () => {
    it('parses valid numeric input', () => {
      expect(parseNum('1 1/2')).toBe(1.5);
    });

    it('falls back to the default value for invalid or empty input', () => {
      expect(parseNum('', 5)).toBe(5);
      expect(parseNum('abc', 7)).toBe(7);
    });
  });
});
