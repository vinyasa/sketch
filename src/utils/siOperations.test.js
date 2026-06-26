import { describe, expect, it } from 'vitest';
import {
  createArcOperation,
  createCoveOperation,
  createHoleOperation,
  resolveCoveEdge,
  resolveOperationAxis,
} from './siOperations';

describe('siOperations', () => {
  it('resolves operation axes from text', () => {
    expect(resolveOperationAxis('drill through x')).toBe('x');
    expect(resolveOperationAxis('cut along z')).toBe('z');
    expect(resolveOperationAxis('drill hole')).toBe('y');
  });

  it('resolves cove edges from text', () => {
    expect(resolveCoveEdge('add cove on bottom')).toBe('bottom');
    expect(resolveCoveEdge('add cove on left')).toBe('left');
    expect(resolveCoveEdge('add cove')).toBe('top');
  });

  it('creates hole and cove operations', () => {
    expect(createHoleOperation(1, -2, 'x')).toEqual({
      id: 1,
      type: 'hole',
      radius: 2,
      offsetX: 0,
      offsetY: 0,
      axis: 'x',
    });

    expect(createCoveOperation(2, -1.5, 'left', 'z')).toEqual({
      id: 2,
      type: 'cove',
      edge: 'left',
      depth: 1.5,
      axis: 'z',
    });
  });

  it('creates arc operations from a text range', () => {
    expect(createArcOperation(3, 'add arc 15 to 120 along x')).toEqual({
      id: 3,
      type: 'arc',
      startAngle: 15,
      endAngle: 120,
      innerRadius: 0,
      axis: 'x',
    });
  });
});
