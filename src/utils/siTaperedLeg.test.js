import { describe, expect, it } from 'vitest';
import {
  createPartialTaperedLegAssembly,
  createStandaloneTaperedLeg,
  createTaperSpec,
} from './siTaperedLeg';

describe('siTaperedLeg', () => {
  it('creates a taper specification for both axes', () => {
    expect(createTaperSpec(1, 2)).toEqual({
      angleLeft: 1,
      angleRight: 1,
      angleFront: 2,
      angleBack: 2,
    });
  });

  it('creates a standalone tapered leg board', () => {
    const board = createStandaloneTaperedLeg({
      id: 10,
      defaultMaterial: { type: 'wood', id: 'oak' },
      ax: 0,
      az: 2,
    });

    expect(board.name).toBe('Tapered Leg');
    expect(board.taper.angleFront).toBe(2);
    expect(board.position).toEqual([0, 15, 0]);
  });

  it('creates a partial tapered leg assembly with glue metadata', () => {
    const result = createPartialTaperedLegAssembly({
      groupId: 'Tapered Leg 1',
      upperId: 100,
      lowerId: 101,
      defaultMaterial: { type: 'wood', id: 'pine' },
      ax: 1,
      az: 3,
    });

    expect(result.group['Tapered Leg 1']).toBeTruthy();
    expect(result.boards).toHaveLength(2);
    expect(result.constraint.offset).toEqual([0, 15, 0]);
    expect(result.halfHeight).toBe(15);
  });
});
