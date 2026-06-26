import { describe, expect, it } from 'vitest';
import {
  createMaterialCommand,
  createMoveCommand,
  createResizeCommand,
  createRotateCommand,
  executeCommand,
  executeCommands,
} from './index';

function makeBoard(overrides = {}) {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Board',
    parentId: overrides.parentId ?? 'Workspace',
    size: overrides.size ?? [10, 2, 4],
    position: overrides.position ?? [0, 1, 0],
    orientation: overrides.orientation ?? [0, 0, 0],
    material: overrides.material ?? { type: 'wood', id: 'oak' },
    ...overrides,
  };
}

function createTestStore(overrides = {}) {
  const state = {
    boards: overrides.boards ?? [
      makeBoard({ id: 1, name: 'Left Leg', parentId: 'Leg Assembly' }),
      makeBoard({ id: 2, name: 'Right Leg', parentId: 'Leg Assembly', position: [12, 1, 0] }),
      makeBoard({ id: 3, name: 'Top Panel', parentId: 'Workspace', size: [24, 1, 12], position: [6, 10, 0] }),
    ],
    groups: overrides.groups ?? {
      Workspace: { parentId: null, name: 'Workspace' },
      'Leg Assembly': { parentId: 'Workspace', name: 'Leg Assembly' },
    },
    selectedItemIds: overrides.selectedItemIds ?? [],
    constraints: overrides.constraints ?? {},
  };

  const get = () => state;
  state.setBoards = (updater) => {
    state.boards = typeof updater === 'function' ? updater(state.boards) : updater;
  };

  return { state, get };
}

describe('executeCommands', () => {
  it('moves selected boards through the shared move executor', () => {
    const { state, get } = createTestStore({ selectedItemIds: ['1'] });

    const processed = executeCommands(
      [createMoveCommand({ target: { scope: 'selected' }, axis: 'x', delta: 5 })],
      get,
    );

    expect(processed).toBe(1);
    expect(state.boards.find((board) => board.id === 1)?.position).toEqual([5, 1, 0]);
    expect(state.boards.find((board) => board.id === 2)?.position).toEqual([12, 1, 0]);
  });

  it('expands named group targets to their descendant boards', () => {
    const { state, get } = createTestStore();

    const processed = executeCommand(
      createMaterialCommand({
        target: { scope: 'name', value: 'leg assembly' },
        material: { type: 'color', hex: '#ff0000' },
      }),
      get,
    );

    expect(processed).toBe(true);
    expect(state.boards.find((board) => board.id === 1)?.material).toEqual({
      type: 'color',
      hex: '#ff0000',
    });
    expect(state.boards.find((board) => board.id === 2)?.material).toEqual({
      type: 'color',
      hex: '#ff0000',
    });
    expect(state.boards.find((board) => board.id === 3)?.material).toEqual({
      type: 'wood',
      id: 'oak',
    });
  });

  it('resizes boards using semantic dimensions', () => {
    const { state, get } = createTestStore({ selectedItemIds: ['3'] });

    const processed = executeCommand(
      createResizeCommand({
        target: { scope: 'selected' },
        dimension: 'width',
        delta: 3,
      }),
      get,
    );

    expect(processed).toBe(true);
    expect(state.boards.find((board) => board.id === 3)?.size).toEqual([24, 1, 15]);
  });

  it('rotates boards and supports reset behavior', () => {
    const { state, get } = createTestStore({ selectedItemIds: ['1'] });

    const rotated = executeCommand(
      createRotateCommand({
        target: { scope: 'selected' },
        axis: 'z',
        degrees: 90,
      }),
      get,
    );

    expect(rotated).toBe(true);
    expect(state.boards.find((board) => board.id === 1)?.orientation?.[2]).toBeCloseTo(
      Math.PI / 2,
    );

    const reset = executeCommand(
      createRotateCommand({
        target: { scope: 'selected' },
        axis: 'z',
        reset: true,
      }),
      get,
    );

    expect(reset).toBe(true);
    expect(state.boards.find((board) => board.id === 1)?.orientation).toEqual([0, 0, 0]);
  });

  it('applies material commands to all boards', () => {
    const { state, get } = createTestStore();

    const processed = executeCommand(
      createMaterialCommand({
        target: { scope: 'all' },
        material: { type: 'wood', id: 'walnut' },
      }),
      get,
    );

    expect(processed).toBe(true);
    expect(state.boards.every((board) => board.material.id === 'walnut')).toBe(true);
  });

  it('returns false for unresolved targets or no-op commands', () => {
    const { get } = createTestStore();

    expect(
      executeCommand(
        createMoveCommand({ target: { scope: 'name', value: 'missing' }, axis: 'x', delta: 2 }),
        get,
      ),
    ).toBe(false);

    expect(
      executeCommand(
        createResizeCommand({ target: { scope: 'all' }, dimension: 'length', delta: 0 }),
        get,
      ),
    ).toBe(false);
  });
});
