import { describe, expect, it } from 'vitest';
import {
  COMMAND_TYPES,
  createMaterialCommand,
  createMoveCommand,
  createResizeCommand,
  createRotateCommand,
} from './index';

describe('command types and factories', () => {
  it('exports the expected command type constants', () => {
    expect(COMMAND_TYPES).toEqual({
      MOVE: 'move',
      RESIZE: 'resize',
      ROTATE: 'rotate',
      MATERIAL: 'material',
    });
  });

  it('creates move commands', () => {
    expect(
      createMoveCommand({ target: { scope: 'selected' }, axis: 'x', delta: 2 }),
    ).toEqual({
      type: 'move',
      target: { scope: 'selected' },
      axis: 'x',
      delta: 2,
    });
  });

  it('creates resize commands', () => {
    expect(
      createResizeCommand({ target: { scope: 'all' }, dimension: 'width', delta: -1 }),
    ).toEqual({
      type: 'resize',
      target: { scope: 'all' },
      dimension: 'width',
      delta: -1,
    });
  });

  it('creates rotate commands with defaults', () => {
    expect(createRotateCommand({ target: { scope: 'selected' }, axis: 'z' })).toEqual({
      type: 'rotate',
      target: { scope: 'selected' },
      axis: 'z',
      degrees: 0,
      flip: false,
      reset: false,
      pivot: undefined,
    });
  });

  it('creates material commands', () => {
    expect(
      createMaterialCommand({
        target: { scope: 'name', value: 'leg' },
        material: { type: 'wood', id: 'walnut' },
      }),
    ).toEqual({
      type: 'material',
      target: { scope: 'name', value: 'leg' },
      material: { type: 'wood', id: 'walnut' },
    });
  });
});
