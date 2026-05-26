import * as THREE from 'three';
import { OBB } from 'three/addons/math/OBB.js';

/**
 * Analyzes the touch connection between two boards.
 * Returns null if they are not touching, or an object describing the connection.
 */
export function analyzeTouchConnection(boardA, boardB) {
  if (!boardA || !boardB) return null;

  // 1. Create OBBs to verify physical touch / intersection (slightly expanded)
  const createOBB = (b, expandAmount = 0.02) => {
    const rot = b.orientation || b.rotation || [0, 0, 0];
    const euler = new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ');
    const quaternion = new THREE.Quaternion().setFromEuler(euler);
    const position = new THREE.Vector3(...b.position);

    let matrix = new THREE.Matrix4();
    if (b.pivot) {
      const pivotPos = new THREE.Vector3(...b.pivot);
      const rotationMatrix = new THREE.Matrix4().makeRotationFromQuaternion(quaternion);
      const invPivotMatrix = new THREE.Matrix4().makeTranslation(-pivotPos.x, -pivotPos.y, -pivotPos.z);
      const translationMatrix = new THREE.Matrix4().makeTranslation(position.x, position.y, position.z);
      matrix.multiply(translationMatrix).multiply(rotationMatrix).multiply(invPivotMatrix);
    } else {
      matrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1));
    }

    const obb = new OBB();
    // Expand the OBB by tolerance to capture perfectly flush boards
    obb.halfSize.set(
      b.size[0] / 2 + expandAmount,
      b.size[1] / 2 + expandAmount,
      b.size[2] / 2 + expandAmount
    );
    obb.applyMatrix4(matrix);
    return obb;
  };

  const obbA = createOBB(boardA);
  const obbB = createOBB(boardB);

  // If expanded OBBs do not intersect, they are not touching
  if (!obbA.intersectsOBB(obbB)) {
    return null;
  }

  // 2. Perform bounding box touch analysis (assuming axis-aligned for connection details)
  const aMinX = boardA.position[0] - boardA.size[0] / 2;
  const aMaxX = boardA.position[0] + boardA.size[0] / 2;
  const aMinY = boardA.position[1] - boardA.size[1] / 2;
  const aMaxY = boardA.position[1] + boardA.size[1] / 2;
  const aMinZ = boardA.position[2] - boardA.size[2] / 2;
  const aMaxZ = boardA.position[2] + boardA.size[2] / 2;

  const bMinX = boardB.position[0] - boardB.size[0] / 2;
  const bMaxX = boardB.position[0] + boardB.size[0] / 2;
  const bMinY = boardB.position[1] - boardB.size[1] / 2;
  const bMaxY = boardB.position[1] + boardB.size[1] / 2;
  const bMinZ = boardB.position[2] - boardB.size[2] / 2;
  const bMaxZ = boardB.position[2] + boardB.size[2] / 2;

  const TOLERANCE = 0.05; // 1/20 inch tolerance for flush detection

  let touchAxis = null; // 'x', 'y', 'z'
  let contactFaceA = null;
  let contactFaceB = null;

  // Check X touch: Face A touches Face B
  if (Math.abs(aMaxX - bMinX) < TOLERANCE) {
    touchAxis = 'x';
    contactFaceA = 'right';
    contactFaceB = 'left';
  } else if (Math.abs(aMinX - bMaxX) < TOLERANCE) {
    touchAxis = 'x';
    contactFaceA = 'left';
    contactFaceB = 'right';
  }
  // Check Y touch
  else if (Math.abs(aMaxY - bMinY) < TOLERANCE) {
    touchAxis = 'y';
    contactFaceA = 'top';
    contactFaceB = 'bottom';
  } else if (Math.abs(aMinY - bMaxY) < TOLERANCE) {
    touchAxis = 'y';
    contactFaceA = 'bottom';
    contactFaceB = 'top';
  }
  // Check Z touch
  else if (Math.abs(aMaxZ - bMinZ) < TOLERANCE) {
    touchAxis = 'z';
    contactFaceA = 'front';
    contactFaceB = 'back';
  } else if (Math.abs(aMinZ - bMaxZ) < TOLERANCE) {
    touchAxis = 'z';
    contactFaceA = 'back';
    contactFaceB = 'front';
  }

  if (!touchAxis) {
    // If no flush face touch is found directly, they might intersect or be slightly nested (e.g. dado/rabbet)
    // We fall back to standard center proximity
    return null;
  }

  // Calculate overlap range in the other two axes
  const overlapX = [Math.max(aMinX, bMinX), Math.min(aMaxX, bMaxX)];
  const overlapY = [Math.max(aMinY, bMinY), Math.min(aMaxY, bMaxY)];
  const overlapZ = [Math.max(aMinZ, bMinZ), Math.min(aMaxZ, bMaxZ)];

  const spanX = overlapX[1] - overlapX[0];
  const spanY = overlapY[1] - overlapY[0];
  const spanZ = overlapZ[1] - overlapZ[0];

  // Verify that the other two axes actually overlap (positive span)
  if (touchAxis === 'x' && (spanY <= 0 || spanZ <= 0)) return null;
  if (touchAxis === 'y' && (spanX <= 0 || spanZ <= 0)) return null;
  if (touchAxis === 'z' && (spanX <= 0 || spanY <= 0)) return null;

  // 3. Classify relative orientation
  // A connection is parallel ONLY if the board planes (thickness axes) and long axes are both parallel.
  // Otherwise, they meet at right angles (perpendicular).
  const getShortestAxis = (size) => {
    let minVal = Infinity;
    let minIdx = 0;
    for (let i = 0; i < 3; i++) {
      if (size[i] < minVal) {
        minVal = size[i];
        minIdx = i;
      }
    }
    return minIdx;
  };

  const getLongestAxis = (size) => {
    let maxVal = -1;
    let maxIdx = 0;
    for (let i = 0; i < 3; i++) {
      if (size[i] > maxVal) {
        maxVal = size[i];
        maxIdx = i;
      }
    }
    return maxIdx; // 0=X, 1=Y, 2=Z
  };

  const shortAxisA = getShortestAxis(boardA.size);
  const shortAxisB = getShortestAxis(boardB.size);
  const longAxisA = getLongestAxis(boardA.size);
  const longAxisB = getLongestAxis(boardB.size);

  const isParallel = shortAxisA === shortAxisB && longAxisA === longAxisB;
  const jointType = isParallel ? 'parallel' : 'right-angle';

  // 4. Compute distribution list of fasteners using the Auto Spacing Rule
  // Determine which axis of the contact plane is longer to distribute fasteners along
  let distAxis = null;
  let range = [];
  if (touchAxis === 'x') {
    distAxis = spanZ > spanY ? 'z' : 'y';
    range = distAxis === 'z' ? overlapZ : overlapY;
  } else if (touchAxis === 'y') {
    distAxis = spanZ > spanX ? 'z' : 'x';
    range = distAxis === 'z' ? overlapZ : overlapX;
  } else {
    distAxis = spanY > spanX ? 'y' : 'x';
    range = distAxis === 'y' ? overlapY : overlapX;
  }

  const getPositions = (count = 2) => {
    const minVal = range[0];
    const maxVal = range[1];
    const totalLength = maxVal - minVal;
    
    // Auto-spacing rule: 2 inch margin from outer corners
    const margin = 2.0;
    const activeLength = totalLength - 2 * margin;

    const coords = [];
    if (activeLength <= 0 || count === 1) {
      // Too short for margin, place in center of contact area
      coords.push((minVal + maxVal) / 2);
    } else {
      const step = activeLength / (count - 1);
      for (let k = 0; k < count; k++) {
        coords.push(minVal + margin + k * step);
      }
    }
    return { axis: distAxis, coords, range };
  };

  // Center of contact in the touch axis
  const touchCenter = touchAxis === 'x' ? (aMaxX + bMinX) / 2 
                     : touchAxis === 'y' ? (aMaxY + bMinY) / 2 
                     : (aMaxZ + bMinZ) / 2;

  // Center of the intersection plane in all 3 dimensions
  const centerPos = [
    touchAxis === 'x' ? touchCenter : (overlapX[0] + overlapX[1]) / 2,
    touchAxis === 'y' ? touchCenter : (overlapY[0] + overlapY[1]) / 2,
    touchAxis === 'z' ? touchCenter : (overlapZ[0] + overlapZ[1]) / 2
  ];

  return {
    touchAxis,
    contactFaceA,
    contactFaceB,
    jointType,
    centerPos,
    overlapSpans: [spanX, spanY, spanZ],
    getPositions
  };
}
