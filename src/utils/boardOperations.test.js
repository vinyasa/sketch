import { describe, expect, it } from 'vitest';
import { appendOperationToBoards } from './boardOperations';

function makeBoard(overrides = {}) {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Board',
    operations: overrides.operations ?? [],
    ...overrides,
  };
}

describe('boardOperations', () => {
  it('appends an operation to selected boards only', () => {
    const boards = [
      makeBoard({ id: 1, operations: [] }),
      makeBoard({ id: 2, operations: [{ id: 'existing', type: 'hole' }] }),
    ];
    const operation = { id: 'new-op', type: 'cove' };

    const next = appendOperationToBoards(boards, ['2'], operation);

    expect(next[0].operations).toEqual([]);
    expect(next[1].operations).toEqual([
      { id: 'existing', type: 'hole' },
      { id: 'new-op', type: 'cove' },
    ]);
  });

  it('treats missing operation arrays as empty', () => {
    const boards = [makeBoard({ id: 3, operations: undefined })];
    const operation = { id: 'arc-1', type: 'arc' };

    const next = appendOperationToBoards(boards, ['3'], operation);

    expect(next[0].operations).toEqual([{ id: 'arc-1', type: 'arc' }]);
  });
});
