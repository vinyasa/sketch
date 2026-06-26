export const COMMAND_TYPES = {
  MOVE: 'move',
  RESIZE: 'resize',
  ROTATE: 'rotate',
  MATERIAL: 'material',
};

export function createMoveCommand({ target, axis, delta }) {
  return { type: COMMAND_TYPES.MOVE, target, axis, delta };
}

export function createResizeCommand({ target, dimension, delta }) {
  return { type: COMMAND_TYPES.RESIZE, target, dimension, delta };
}

export function createRotateCommand({ target, axis, degrees = 0, flip = false, reset = false, pivot }) {
  return { type: COMMAND_TYPES.ROTATE, target, axis, degrees, flip, reset, pivot };
}

export function createMaterialCommand({ target, material }) {
  return { type: COMMAND_TYPES.MATERIAL, target, material };
}
