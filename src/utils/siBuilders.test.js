import { describe, expect, it } from 'vitest';
import {
  createCubeAssembly,
  createProceduralBoxAssembly,
  createSimpleLeg,
  createTopBoard,
} from './siBuilders';

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

describe('siBuilders', () => {
  it('creates a simple leg board', () => {
    const leg = createSimpleLeg({ id: 1, defaultMaterial: { type: 'wood', id: 'oak' } });
    expect(leg.name).toBe('New Leg');
    expect(leg.position).toEqual([0, 6, 0]);
  });

  it('creates a top board sized to the target bounds', () => {
    const result = createTopBoard({
      id: 2,
      targets: [
        makeBoard({ size: [10, 2, 4], position: [0, 1, 0], parentId: 'GroupA' }),
        makeBoard({ size: [6, 2, 4], position: [10, 1, 0], parentId: 'GroupA' }),
      ],
      defaultMaterial: { type: 'wood', id: 'pine' },
    });
    expect(result.board.name).toBe('Table Top');
    expect(result.board.parentId).toBe('GroupA');
  });

  it('creates a cube assembly with six panels', () => {
    const result = createCubeAssembly({
      groupId: 'Cube 1',
      defaultMaterial: { type: 'wood', id: 'maple' },
      idBase: 100,
    });
    expect(result.boards).toHaveLength(6);
    expect(result.group['Cube 1']).toBeTruthy();
  });

  it('creates a procedural box assembly from wall data', () => {
    const result = createProceduralBoxAssembly({
      groupId: 'Assembly 1',
      defaultMaterial: { type: 'wood', id: 'birch' },
      width: 24,
      depth: 16,
      height: 12,
      idBase: 200,
    });
    expect(result.group['Assembly 1'].meta.w).toBe(24);
    expect(result.boards.length).toBeGreaterThan(0);
  });
});
