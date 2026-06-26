import { describe, expect, it } from 'vitest';
import {
  checkConstraintConflict,
  faceToAxis,
  getFaceWorldPos,
  getFlushConnectedSet,
  getGlueConnectedSet,
  propagateMove,
  solveFlushSnap,
} from './constraintSolver';

function makeBoard(overrides = {}) {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Board',
    size: overrides.size ?? [10, 2, 4],
    position: overrides.position ?? [0, 1, 0],
    orientation: overrides.orientation ?? [0, 0, 0],
    pivot: overrides.pivot ?? [0, 0, 0],
    ...overrides,
  };
}

describe('constraintSolver', () => {
  it('maps face strings to the expected axis index', () => {
    expect(faceToAxis('x+')).toBe(0);
    expect(faceToAxis('y-')).toBe(1);
    expect(faceToAxis('z+')).toBe(2);
    expect(faceToAxis(null)).toBeNull();
  });

  it('returns face world positions for unrotated boards', () => {
    const board = makeBoard({ size: [10, 2, 4], position: [0, 1, 0] });

    expect(getFaceWorldPos(board, 'x+')).toEqual([5, 1, 0]);
    expect(getFaceWorldPos(board, 'y-')).toEqual([0, 0, 0]);
    expect(getFaceWorldPos(board, 'z+')).toEqual([0, 1, 2]);
  });

  it('rejects self-constraints and duplicate constraints', () => {
    const constraints = {
      c1: {
        type: 'Flush',
        boardAId: '1',
        boardBId: '2',
        axis: 0,
        enabled: true,
      },
    };

    expect(
      checkConstraintConflict({ type: 'Glue', boardAId: '1', boardBId: '1' }, constraints, []),
    ).toBe('A board cannot be constrained to itself.');

    expect(
      checkConstraintConflict(
        { type: 'Flush', boardAId: '1', boardBId: '2', axis: 0 },
        constraints,
        [],
      ),
    ).toContain('already exists');
  });

  it('finds transitive flush and glue connected sets', () => {
    const constraints = {
      f1: { type: 'Flush', boardAId: '1', boardBId: '2', axis: 0, enabled: true },
      f2: { type: 'Flush', boardAId: '2', boardBId: '3', axis: 0, enabled: true },
      g1: { type: 'Glue', boardAId: '4', boardBId: '5', enabled: true },
      g2: { type: 'Glue', boardAId: '5', boardBId: '6', enabled: true },
    };

    expect(Array.from(getFlushConnectedSet('1', 0, constraints)).sort()).toEqual(['1', '2', '3']);
    expect(Array.from(getGlueConnectedSet('4', constraints)).sort()).toEqual(['4', '5', '6']);
  });

  it('propagates full movement through glue-connected boards', () => {
    const constraints = {
      g1: { type: 'Glue', boardAId: '1', boardBId: '2', enabled: true },
      g2: { type: 'Glue', boardAId: '2', boardBId: '3', enabled: true },
    };

    const moveMap = propagateMove(['1'], [2, 0, -1], constraints);

    expect(moveMap.get('1')).toEqual([2, 0, -1]);
    expect(moveMap.get('2')).toEqual([2, 0, -1]);
    expect(moveMap.get('3')).toEqual([2, 0, -1]);
  });

  it('solves a flush snap by aligning one board face to another', () => {
    const boardA = makeBoard({ size: [10, 2, 4], position: [0, 1, 0] });
    const boardB = makeBoard({ size: [10, 2, 4], position: [20, 1, 0] });

    const newPos = solveFlushSnap(boardA, 'x+', boardB, 'x-');
    expect(newPos).toEqual([10, 1, 0]);
  });
});
