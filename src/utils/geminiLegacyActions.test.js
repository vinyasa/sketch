import { describe, expect, it, vi } from 'vitest';
import { applyGeminiLegacyAction } from './geminiLegacyActions';

function makeBoard(overrides = {}) {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Board',
    parentId: overrides.parentId ?? 'Workspace',
    size: overrides.size ?? [10, 2, 4],
    position: overrides.position ?? [0, 1, 0],
    material: overrides.material ?? { type: 'wood', id: 'oak' },
    operations: overrides.operations ?? [],
    ...overrides,
  };
}

describe('geminiLegacyActions', () => {
  it('creates a table top across the current workspace bounds', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const result = applyGeminiLegacyAction(
      { type: 'addTop' },
      {
        boards: [
          makeBoard({ id: 1, size: [10, 2, 4], position: [0, 1, 0] }),
          makeBoard({ id: 2, size: [6, 2, 4], position: [10, 1, 0] }),
        ],
        defaultMaterial: { type: 'wood', id: 'pine' },
        targetIds: [],
      },
    );

    expect(result.addedBoards).toHaveLength(1);
    expect(result.addedBoards[0].name).toBe('Table Top');
    expect(result.selectedItemIds).toEqual(['1000']);
  });

  it('clones targeted boards along the requested axis', () => {
    vi.spyOn(Date, 'now').mockReturnValue(2000);
    const result = applyGeminiLegacyAction(
      { type: 'clone', axis: 'x', count: 2, gap: 1 },
      {
        boards: [makeBoard({ id: 1, name: 'Leg', size: [2, 10, 2], position: [0, 5, 0] })],
        defaultMaterial: { type: 'wood', id: 'pine' },
        targetIds: ['1'],
      },
    );

    expect(result.addedBoards).toHaveLength(2);
    expect(result.addedBoards[0].position).toEqual([3, 5, 0]);
    expect(result.addedBoards[1].position).toEqual([6, 5, 0]);
  });

  it('creates multiple shelves within the target span', () => {
    vi.spyOn(Date, 'now').mockReturnValue(3000);
    const result = applyGeminiLegacyAction(
      { type: 'addShelf', count: 2 },
      {
        boards: [makeBoard({ id: 1, name: 'Cabinet', size: [24, 30, 12], position: [0, 15, 0] })],
        defaultMaterial: { type: 'wood', id: 'birch' },
        targetIds: ['1'],
      },
    );

    expect(result.addedBoards).toHaveLength(2);
    expect(result.addedBoards[0].name).toBe('Shelf 1');
    expect(result.selectedItemIds).toEqual(['3001', '3002']);
  });

  it('returns null when an action cannot be applied', () => {
    expect(
      applyGeminiLegacyAction(
        { type: 'clone', count: 1 },
        { boards: [], defaultMaterial: { type: 'wood', id: 'oak' }, targetIds: [] },
      ),
    ).toBeNull();
  });
});
