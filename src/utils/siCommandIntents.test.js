import { describe, expect, it } from 'vitest';
import {
  resolveMoveAxis,
  resolveResizeDelta,
  resolveResizeDimension,
  resolveRotateAxis,
  resolveSignedMoveAmount,
} from './siCommandIntents';

describe('siCommandIntents', () => {
  it('resolves move axes from directional text', () => {
    expect(resolveMoveAxis('move left')).toBe('x');
    expect(resolveMoveAxis('move back')).toBe('z');
    expect(resolveMoveAxis('move up')).toBe('y');
  });

  it('resolves signed move amounts using a parser callback', () => {
    const parse = (token) => Number(token);
    expect(resolveSignedMoveAmount('move left 3', parse)).toBe(-3);
    expect(resolveSignedMoveAmount('move right 2', parse)).toBe(2);
  });

  it('resolves resize dimensions from descriptive phrases', () => {
    expect(resolveResizeDimension('make this taller')).toBe('height');
    expect(resolveResizeDimension('make this wider')).toBe('width');
    expect(resolveResizeDimension('make this longer')).toBe('length');
  });

  it('resolves positive and negative resize deltas', () => {
    expect(resolveResizeDelta('make this wider', 2)).toBe(2);
    expect(resolveResizeDelta('trim this', 2)).toBe(-2);
  });

  it('resolves rotate axes from text', () => {
    expect(resolveRotateAxis('rotate on red')).toBe('x');
    expect(resolveRotateAxis('rotate on blue')).toBe('z');
    expect(resolveRotateAxis('rotate')).toBe('y');
  });
});
