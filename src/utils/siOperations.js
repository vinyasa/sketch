export function resolveOperationAxis(lower) {
  let axis = 'y';
  if (/(through x|along x|\bx axis\b)/.test(lower)) axis = 'x';
  else if (/(through z|along z|\bz axis\b)/.test(lower)) axis = 'z';
  return axis;
}

export function resolveCoveEdge(lower) {
  if (/bottom/.test(lower)) return 'bottom';
  if (/left/.test(lower)) return 'left';
  if (/right/.test(lower)) return 'right';
  return 'top';
}

export function createHoleOperation(id, radius, axis) {
  return {
    id,
    type: 'hole',
    radius: Math.abs(radius),
    offsetX: 0,
    offsetY: 0,
    axis,
  };
}

export function createCoveOperation(id, depth, edge, axis) {
  return {
    id,
    type: 'cove',
    edge,
    depth: Math.abs(depth),
    axis,
  };
}

export function createArcOperation(id, lower) {
  const angleMatch = lower.match(/(\d+)\s*(?:to|-|through)\s*(\d+)/);
  const startAngle = angleMatch ? parseInt(angleMatch[1], 10) : 0;
  const endAngle = angleMatch ? parseInt(angleMatch[2], 10) : 90;
  return {
    id,
    type: 'arc',
    startAngle,
    endAngle,
    innerRadius: 0,
    axis: resolveOperationAxis(lower),
  };
}
