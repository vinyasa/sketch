import { describe, expect, it } from 'vitest';
import {
  resolveLegacyAiTargetIds,
  resolveSelectionOrNamedTarget,
  resolveTargetIds,
} from './workspaceTargets';

function makeBoard(overrides = {}) {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Board',
    parentId: overrides.parentId ?? 'Workspace',
    size: overrides.size ?? [10, 2, 4],
    position: overrides.position ?? [0, 1, 0],
    ...overrides,
  };
}

describe('workspaceTargets', () => {
  const boards = [
    makeBoard({ id: 1, name: 'Left Leg', parentId: 'Leg Assembly' }),
    makeBoard({ id: 2, name: 'Right Leg', parentId: 'Leg Assembly' }),
    makeBoard({ id: 3, name: 'Top Panel', parentId: 'Workspace' }),
  ];

  const groups = {
    Workspace: { parentId: null, name: 'Workspace' },
    'Leg Assembly': { parentId: 'Workspace', name: 'Leg Assembly' },
  };

  it('resolves selected targets', () => {
    expect(resolveTargetIds({ scope: 'selected' }, boards, groups, ['3'])).toEqual(['3']);
  });

  it('expands named group targets to descendant board ids', () => {
    expect(resolveTargetIds({ scope: 'name', value: 'leg assembly' }, boards, groups, [])).toEqual(
      ['1', '2'],
    );
  });

  it('resolves a selected-or-named command target for SI flows', () => {
    expect(resolveSelectionOrNamedTarget(['2'], boards, 'move this')).toEqual({
      scope: 'selected',
    });

    expect(resolveSelectionOrNamedTarget([], boards, 'rotate left leg 90')).toEqual({
      scope: 'ids',
      ids: ['1'],
    });
  });

  it('resolves legacy AI targets from string forms', () => {
    expect(resolveLegacyAiTargetIds('selected', boards, groups, ['3'])).toEqual(['3']);
    expect(resolveLegacyAiTargetIds('leg assembly', boards, groups, [])).toEqual(['1', '2']);
    expect(resolveLegacyAiTargetIds(['2', '3'], boards, groups, [])).toEqual(['2', '3']);
  });
});
