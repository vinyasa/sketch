import * as THREE from 'three';

// ── Snap point computation for Measure Mode ─────────────────────────────────
// Returns all snap-able points for a board in world space.
const computeSnapPoints = (board) => {
  const hx = board.size[0] / 2, hy = board.size[1] / 2, hz = board.size[2] / 2;
  const euler = new THREE.Euler(...(board.orientation || [0, 0, 0]), 'YXZ');
  const pivot = board.pivot || [0, 0, 0];

  const toWorld = (lx, ly, lz) => {
    const pt = new THREE.Vector3(lx - pivot[0], ly - pivot[1], lz - pivot[2]);
    pt.applyEuler(euler);
    return [pt.x + board.position[0], pt.y + board.position[1], pt.z + board.position[2]];
  };

  const points = [];
  
  // Pivot point
  points.push({ localOffset: [pivot[0], pivot[1], pivot[2]], worldPos: toWorld(pivot[0], pivot[1], pivot[2]), type: 'pivot' });

  // 8 corners
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    points.push({ localOffset: [sx*hx, sy*hy, sz*hz], worldPos: toWorld(sx*hx, sy*hy, sz*hz), type: 'corner' });
  }
  // 12 edge midpoints
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    points.push({ localOffset: [sx*hx, sy*hy, 0], worldPos: toWorld(sx*hx, sy*hy, 0), type: 'edge' });
    points.push({ localOffset: [sx*hx, 0, sy*hz], worldPos: toWorld(sx*hx, 0, sy*hz), type: 'edge' });
    points.push({ localOffset: [0, sx*hy, sy*hz], worldPos: toWorld(0, sx*hy, sy*hz), type: 'edge' });
  }
  // 6 face centers
  points.push({ localOffset: [hx, 0, 0], worldPos: toWorld(hx, 0, 0), type: 'face' });
  points.push({ localOffset: [-hx, 0, 0], worldPos: toWorld(-hx, 0, 0), type: 'face' });
  points.push({ localOffset: [0, hy, 0], worldPos: toWorld(0, hy, 0), type: 'face' });
  points.push({ localOffset: [0, -hy, 0], worldPos: toWorld(0, -hy, 0), type: 'face' });
  points.push({ localOffset: [0, 0, hz], worldPos: toWorld(0, 0, hz), type: 'face' });
  points.push({ localOffset: [0, 0, -hz], worldPos: toWorld(0, 0, -hz), type: 'face' });

  return points;
};

const findNearestSnap = (worldPoint, board) => {
  const snapPoints = computeSnapPoints(board);
  let best = null, bestDist = Infinity;
  const thresholds = { pivot: 2.5, corner: 2.0, edge: 1.5, face: 1.0 };
  for (const sp of snapPoints) {
    const d = Math.sqrt(
      (sp.worldPos[0] - worldPoint[0]) ** 2 +
      (sp.worldPos[1] - worldPoint[1]) ** 2 +
      (sp.worldPos[2] - worldPoint[2]) ** 2
    );
    const thresh = thresholds[sp.type] || 1.0;
    if (d < thresh && d < bestDist) { best = sp; bestDist = d; }
  }
  return best;
};

export { computeSnapPoints, findNearestSnap };
