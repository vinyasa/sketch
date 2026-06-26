import { describe, expect, it } from 'vitest';
import { collectSiTopTargets } from './siTargetSelection';

function makeBoard(overrides = {}) {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Board',
    parentId: overrides.parentId ?? 'Workspace',
    ...overrides,
  };
}

describe('siTargetSelection', () => {
  const boards = [
    makeBoard({ id: 1, name: 'A', parentId: 'GroupA' }),
    makeBoard({ id: 2, name: 'B', parentId: 'GroupB' }),
    makeBoard({ id: 3, name: 'C', parentId: 'Workspace' }),
  ];

  const groups = {
    Workspace: { parentId: null },
    GroupA: { parentId: 'Workspace' },
    GroupB: { parentId: 'GroupA' },
  };

  it('returns all boards when nothing is selected', () => {
    expect(collectSiTopTargets([], boards, groups)).toEqual(boards);
  });

  it('returns all boards when workspace is selected', () => {
    expect(collectSiTopTargets(['Workspace'], boards, groups)).toEqual(boards);
  });

  it('collects descendant boards for a selected group', () => {
    expect(collectSiTopTargets(['GroupA'], boards, groups).map((board) => board.name).sort()).toEqual([
      'A',
      'B',
    ]);
  });

  it('returns explicitly selected boards', () => {
    expect(collectSiTopTargets(['3'], boards, groups).map((board) => board.name)).toEqual(['C']);
  });
});
