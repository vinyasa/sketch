import { describe, expect, it } from 'vitest';
import {
  calculateGroupAABB,
  collectChildBoards,
  computeWorldAABB,
} from './sceneGraph';

function makeBoard(overrides = {}) {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Board',
    parentId: overrides.parentId ?? 'Workspace',
    size: overrides.size ?? [10, 2, 4],
    position: overrides.position ?? [0, 1, 0],
    orientation: overrides.orientation ?? [0, 0, 0],
    shape: overrides.shape ?? 'box',
    ...overrides,
  };
}

describe('sceneGraph', () => {
  it('collects child boards recursively through nested groups', () => {
    const boards = [
      makeBoard({ id: 1, name: 'A', parentId: 'GroupA' }),
      makeBoard({ id: 2, name: 'B', parentId: 'GroupB' }),
    ];

    const groups = {
      Workspace: { parentId: null },
      GroupA: { parentId: 'Workspace' },
      GroupB: { parentId: 'GroupA' },
    };

    const collected = collectChildBoards('GroupA', boards, groups);
    expect(collected.map((b) => b.name).sort()).toEqual(['A', 'B']);
  });

  it('computes world AABB for axis-aligned boards', () => {
    const aabb = computeWorldAABB([
      makeBoard({ size: [10, 2, 4], position: [0, 1, 0] }),
      makeBoard({ size: [6, 2, 4], position: [10, 1, 0] }),
    ]);

    expect(aabb).toEqual({
      minX: -5,
      maxX: 13,
      minY: 0,
      maxY: 2,
      minZ: -2,
      maxZ: 2,
    });
  });

  it('ignores plane helper boards in AABB calculations', () => {
    const aabb = computeWorldAABB([
      makeBoard({ size: [10, 2, 4], position: [0, 1, 0] }),
      makeBoard({ id: 2, shape: 'plane', size: [100, 1, 100], position: [0, 0, 0] }),
    ]);

    expect(aabb).toEqual({
      minX: -5,
      maxX: 5,
      minY: 0,
      maxY: 2,
      minZ: -2,
      maxZ: 2,
    });
  });

  it('computes a group AABB summary for descendant boards', () => {
    const boards = [
      makeBoard({ id: 1, name: 'A', parentId: 'GroupA', size: [10, 2, 4], position: [0, 1, 0] }),
      makeBoard({ id: 2, name: 'B', parentId: 'GroupB', size: [6, 2, 4], position: [10, 1, 0] }),
    ];

    const groups = {
      Workspace: { parentId: null },
      GroupA: { parentId: 'Workspace' },
      GroupB: { parentId: 'GroupA' },
    };

    const aabb = calculateGroupAABB('GroupA', boards, groups);
    expect(aabb.width).toBe(18);
    expect(aabb.height).toBe(2);
    expect(aabb.depth).toBe(4);
    expect(aabb.centerX).toBe(4);
  });
});
