import * as THREE from 'three';
import { Evaluator, SUBTRACTION, INTERSECTION, Brush } from 'three-bvh-csg';
import {
  buildTaperGeometry,
  normalizeTaper,
  buildArcTool,
  buildCoveTool,
  buildDadoTool,
  buildMiterTool,
  buildEdgeProfileTool
} from './geometryBuilders';

const csgEvaluator = new Evaluator();

// ── Main Cut Angle Analyzer Function ────────────────────────────────────────
export function calculateBoardCuts(board) {
  if (!board) return [];

  // 1. Build base geometry
  let baseGeo;
  if (board.shape === 'taper') {
    const { angleLeft, angleRight, angleFront, angleBack } = normalizeTaper(board.taper);
    baseGeo = buildTaperGeometry(board.size[0], board.size[1], board.size[2], angleLeft, angleRight, angleFront, angleBack);
  } else if (board.shape === 'cylinder') {
    const axis = board.cylinder?.axis || 'y';
    const axisIdx = axis === 'x' ? 0 : axis === 'z' ? 2 : 1;
    const dim1 = board.size[(axisIdx + 1) % 3];
    const dim2 = board.size[(axisIdx + 2) % 3];
    const radius = Math.min(dim1, dim2) / 2;
    const height = board.size[axisIdx];
    baseGeo = new THREE.CylinderGeometry(radius, radius, height, 64, 1);
    if (axis === 'x') baseGeo.rotateZ(Math.PI / 2);
    if (axis === 'z') baseGeo.rotateX(Math.PI / 2);
  } else {
    baseGeo = new THREE.BoxGeometry(board.size[0], board.size[1], board.size[2]);
  }

  const activeOps = (board.operations || []).filter(op => op.enabled !== false);
  let finalGeo = baseGeo;

  // 2. Evaluate CSG operations
  if (activeOps.length > 0) {
    const subOps = activeOps.filter(op => ['hole', 'dado', 'miter', 'subtract', 'edge-profile', 'pocket-holes', 'dowel-holes'].includes(op.type));
    const intersOps = activeOps.filter(op => ['arc', 'cove'].includes(op.type));

    let resultBrush = new Brush(baseGeo);
    resultBrush.updateMatrixWorld();

    // Perform subtractions
    for (const op of subOps) {
      try {
        let opBrush;
        if (op.type === 'subtract') {
          const cs = op.cutterSize;
          let cutterGeo;
          if (op.cutterShape === 'cylinder') {
            const cAxis = op.cutterCylinder?.axis || 'y';
            const cAxisIdx = cAxis === 'x' ? 0 : cAxis === 'z' ? 2 : 1;
            const cDim1 = cs[(cAxisIdx + 1) % 3];
            const cDim2 = cs[(cAxisIdx + 2) % 3];
            const cRadius = Math.min(cDim1, cDim2) / 2;
            const cHeight = cs[cAxisIdx];
            cutterGeo = new THREE.CylinderGeometry(cRadius, cRadius, cHeight, 64, 1);
            if (cAxis === 'x') cutterGeo.rotateZ(Math.PI / 2);
            if (cAxis === 'z') cutterGeo.rotateX(Math.PI / 2);
          } else if (op.cutterShape === 'taper' && op.cutterTaper) {
            const { angleLeft, angleRight, angleFront, angleBack } = normalizeTaper(op.cutterTaper);
            cutterGeo = buildTaperGeometry(cs[0], cs[1], cs[2], angleLeft, angleRight, angleFront, angleBack);
          } else {
            cutterGeo = new THREE.BoxGeometry(cs[0], cs[1], cs[2]);
          }
          if (op.relativeMatrix) {
            const m = new THREE.Matrix4().fromArray(op.relativeMatrix);
            cutterGeo.applyMatrix4(m);
          }
          opBrush = new Brush(cutterGeo);
        } else if (op.type === 'miter') {
          opBrush = new Brush(buildMiterTool(board.size, op));
        } else if (op.type === 'dado') {
          opBrush = new Brush(buildDadoTool(board.size, op));
        } else if (op.type === 'edge-profile') {
          opBrush = new Brush(buildEdgeProfileTool(board.size, op));
        } else if (op.type === 'pocket-holes') {
          // Skip complex nested loops for simple geometry analysis
          continue;
        } else if (op.type === 'dowel-holes') {
          continue;
        } else {
          // standard hole
          const axis = op.axis || 'y';
          const r = Math.max(0.01, op.radius || 1);
          const hLength = Math.max(...board.size) + 10;
          const cylGeo = new THREE.CylinderGeometry(r, r, hLength, 32);
          if (axis === 'x') cylGeo.rotateZ(Math.PI / 2);
          else if (axis === 'z') cylGeo.rotateX(Math.PI / 2);
          const ox = op.offsetX || 0;
          const oy = op.offsetY || 0;
          const pos = [0, 0, 0];
          if (axis === 'z') { pos[0] = ox; pos[1] = oy; }
          else if (axis === 'x') { pos[1] = oy; pos[2] = ox; }
          else { pos[0] = ox; pos[2] = oy; }
          cylGeo.translate(pos[0], pos[1], pos[2]);
          opBrush = new Brush(cylGeo);
        }

        opBrush.updateMatrixWorld();
        const prevGeometry = resultBrush.geometry;
        resultBrush = csgEvaluator.evaluate(resultBrush, opBrush, SUBTRACTION);
        resultBrush.updateMatrixWorld();
        if (prevGeometry !== baseGeo) prevGeometry?.dispose();
        opBrush.geometry?.dispose();
      } catch (e) {
        console.error('MiterSawCalc CSG error:', e);
      }
    }

    // Process intersections (arc / cove)
    if (intersOps.length > 0) {
      const byAxis = {};
      for (const op of intersOps) {
        (byAxis[op.axis || 'y'] ??= []).push(op);
      }
      for (const ops of Object.values(byAxis)) {
        try {
          const buildTool = (op) => {
            if (op.type === 'arc')  return new Brush(buildArcTool(board.size, op));
            if (op.type === 'cove') return new Brush(buildCoveTool(board.size, op));
            return null;
          };
          let axisTool = buildTool(ops[0]);
          if (!axisTool) continue;
          axisTool.updateMatrixWorld();

          for (let i = 1; i < ops.length; i++) {
            const nextTool = buildTool(ops[i]);
            if (!nextTool) continue;
            nextTool.updateMatrixWorld();
            const prevGeo = axisTool.geometry;
            axisTool = csgEvaluator.evaluate(axisTool, nextTool, INTERSECTION);
            axisTool.updateMatrixWorld();
            prevGeo?.dispose();
            nextTool.geometry?.dispose();
          }

          const prevGeometry = resultBrush.geometry;
          resultBrush = csgEvaluator.evaluate(resultBrush, axisTool, INTERSECTION);
          resultBrush.updateMatrixWorld();
          if (prevGeometry !== baseGeo) prevGeometry?.dispose();
          axisTool.geometry?.dispose();
        } catch (e) {
          console.error('MiterSawCalc CSG intersection error:', e);
        }
      }
    }
    finalGeo = resultBrush.geometry;
  }

  // 3. Analyze faces
  const positionAttribute = finalGeo.getAttribute('position');
  const indexAttribute = finalGeo.index;
  const tempNormal = new THREE.Vector3();
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const cb = new THREE.Vector3();
  const ab = new THREE.Vector3();

  const miterCuts = [];

  const addTriangleToCuts = (p0, p1, p2) => {
    vA.fromBufferAttribute(positionAttribute, p0);
    vB.fromBufferAttribute(positionAttribute, p1);
    vC.fromBufferAttribute(positionAttribute, p2);

    // Compute normal
    cb.subVectors(vC, vB);
    ab.subVectors(vA, vB);
    tempNormal.crossVectors(cb, ab);
    const twiceArea = tempNormal.length();
    if (twiceArea < 0.0001) return;
    const area = twiceArea / 2;
    tempNormal.normalize();

    // Centroid
    const centroidX = (vA.x + vB.x + vC.x) / 3;
    const centroidY = (vA.y + vB.y + vC.y) / 3;
    const centroidZ = (vA.z + vB.z + vC.z) / 3;

    // We only care about cut faces that represent a cross-section or end-cut,
    // which always have a significant normal component along the X axis (board length).
    // Standard longitudinal faces (top/bottom: Y, front/back: Z) will have n_x close to 0.
    if (Math.abs(tempNormal.x) < 0.05) return;

    const d = -tempNormal.dot(vA);

    // Try to merge with an existing cut group
    const foundGroup = miterCuts.find(group => {
      // Group by normal vector similarity (dot product > 0.999) AND plane constant similarity (within 0.25")
      const normalDot = group.normal.dot(tempNormal);
      const dDiff = Math.abs(group.d - d);
      return normalDot > 0.999 && dDiff < 0.25;
    });

    if (foundGroup) {
      // Weighted average of normal & centroid based on area
      const newArea = foundGroup.totalArea + area;
      foundGroup.normal.multiplyScalar(foundGroup.totalArea)
        .addScaledVector(tempNormal, area)
        .normalize();
      foundGroup.centerX = (foundGroup.centerX * foundGroup.totalArea + centroidX * area) / newArea;
      foundGroup.centerY = (foundGroup.centerY * foundGroup.totalArea + centroidY * area) / newArea;
      foundGroup.centerZ = (foundGroup.centerZ * foundGroup.totalArea + centroidZ * area) / newArea;
      foundGroup.d = -foundGroup.normal.dot(new THREE.Vector3(foundGroup.centerX, foundGroup.centerY, foundGroup.centerZ));
      foundGroup.totalArea = newArea;
    } else {
      miterCuts.push({
        normal: tempNormal.clone(),
        centerX: centroidX,
        centerY: centroidY,
        centerZ: centroidZ,
        d: d,
        totalArea: area
      });
    }
  };

  if (indexAttribute) {
    for (let j = 0; j < indexAttribute.count; j += 3) {
      addTriangleToCuts(
        indexAttribute.getX(j),
        indexAttribute.getX(j + 1),
        indexAttribute.getX(j + 2)
      );
    }
  } else if (positionAttribute) {
    for (let j = 0; j < positionAttribute.count; j += 3) {
      addTriangleToCuts(j, j + 1, j + 2);
    }
  }

  // Dispose temp base geometries to prevent leaks
  if (baseGeo !== finalGeo) baseGeo.dispose();

  // 4. Convert normals to angles
  const length = board.size[0];
  const results = miterCuts.map(cut => {
    const n = cut.normal;
    // Determine sign: +X faces point right, -X faces point left
    const sign = n.x > 0 ? 1 : -1;

    // Calculate angles
    // Miter: rotation around Y-axis (turntable)
    let miterRad = Math.atan2(sign * n.z, sign * n.x);
    let miterDeg = miterRad * (180 / Math.PI);

    // Bevel: tilt from vertical Y-axis (blade tilt)
    let bevelRad = Math.asin(n.y);
    let bevelDeg = bevelRad * (180 / Math.PI);

    // Round and snap to nearest integer/half-degree if within 0.1°
    const snapAngle = (angle) => {
      const roundedToHalf = Math.round(angle * 2) / 2;
      if (Math.abs(angle - roundedToHalf) < 0.1) {
        return roundedToHalf;
      }
      return parseFloat(angle.toFixed(2));
    };

    miterDeg = snapAngle(miterDeg);
    bevelDeg = snapAngle(bevelDeg);

    // Calculate Top-Front edge intersection point in local coordinates
    const [rx, ry, rz] = board.orientation || [0, 0, 0];
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
    const inverseQuat = quaternion.clone().invert();

    const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(inverseQuat);
    const localFront = new THREE.Vector3(0, 0, 1).applyQuaternion(inverseQuat);

    const sizeAlongUp = Math.abs(localUp.x) * board.size[0] + Math.abs(localUp.y) * board.size[1] + Math.abs(localUp.z) * board.size[2];
    const sizeAlongFront = Math.abs(localFront.x) * board.size[0] + Math.abs(localFront.y) * board.size[1] + Math.abs(localFront.z) * board.size[2];

    const localEdgeY = localUp.y * (sizeAlongUp / 2) + localFront.y * (sizeAlongFront / 2);
    const localEdgeZ = localUp.z * (sizeAlongUp / 2) + localFront.z * (sizeAlongFront / 2);

    let intersectionX = cut.centerX;
    if (Math.abs(n.x) > 0.01) {
      intersectionX = cut.centerX - (n.y * (localEdgeY - cut.centerY) + n.z * (localEdgeZ - cut.centerZ)) / n.x;
    }

    // Label based on position along length
    let label = '';
    const atLeftEnd = Math.abs(cut.centerX - (-length / 2)) < 0.3;
    const atRightEnd = Math.abs(cut.centerX - (length / 2)) < 0.3;
    const isEndCut = atLeftEnd || atRightEnd;

    if (atLeftEnd) {
      label = 'Left End';
    } else if (atRightEnd) {
      label = 'Right End';
    } else {
      const distFromLeft = intersectionX + length / 2;
      label = `Cut at ${distFromLeft.toFixed(2)}"`;
    }

    return {
      label,
      positionX: intersectionX,
      positionY: localEdgeY,
      positionZ: localEdgeZ,
      centerX: cut.centerX,
      centerY: cut.centerY,
      centerZ: cut.centerZ,
      normal: [n.x, n.y, n.z],
      miter: miterDeg,
      bevel: bevelDeg,
      area: cut.totalArea,
      isEndCut
    };
  });

  // Sort left-to-right along X axis
  return results.sort((a, b) => a.positionX - b.positionX);
}

// ── Helper to find intersection with the Top-Front edge of the board ────────
export function getTopFrontIntersection(board, cut) {
  const [rx, ry, rz] = board.orientation || [0, 0, 0];
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
  const inverseQuat = quaternion.clone().invert();

  const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(inverseQuat);
  const localFront = new THREE.Vector3(0, 0, 1).applyQuaternion(inverseQuat);

  const sizeAlongUp = Math.abs(localUp.x) * board.size[0] + Math.abs(localUp.y) * board.size[1] + Math.abs(localUp.z) * board.size[2];
  const sizeAlongFront = Math.abs(localFront.x) * board.size[0] + Math.abs(localFront.y) * board.size[1] + Math.abs(localFront.z) * board.size[2];

  const localEdgeY = localUp.y * (sizeAlongUp / 2) + localFront.y * (sizeAlongFront / 2);
  const localEdgeZ = localUp.z * (sizeAlongUp / 2) + localFront.z * (sizeAlongFront / 2);

  const nx = cut.normal[0];
  const ny = cut.normal[1];
  const nz = cut.normal[2];

  const cx = cut.centerX !== undefined ? cut.centerX : cut.positionX;
  const cy = cut.centerY !== undefined ? cut.centerY : cut.positionY;
  const cz = cut.centerZ !== undefined ? cut.centerZ : cut.positionZ;

  let intersectionX = cx;
  if (Math.abs(nx) > 0.01) {
    intersectionX = cx - (ny * (localEdgeY - cy) + nz * (localEdgeZ - cz)) / nx;
  }

  const localPos = new THREE.Vector3(intersectionX, localEdgeY, localEdgeZ);
  const worldPos = localPos.clone().applyEuler(new THREE.Euler(rx, ry, rz, 'YXZ')).add(new THREE.Vector3(...board.position));

  return {
    localX: intersectionX,
    worldPos,
  };
}

// ── Helper to calculate miter/bevel saw angles based on orientation ────────
export function getDynamicAngles(board, cut) {
  if (!board || !cut || !cut.normal) return { miter: 0, bevel: 0 };

  const [rx, ry, rz] = board.orientation || [0, 0, 0];
  const euler = new THREE.Euler(rx, ry, rz, 'YXZ');
  const quaternion = new THREE.Quaternion().setFromEuler(euler);
  const inverseQuat = quaternion.clone().invert();

  // Reference saw directions in world coordinates
  const worldUp = new THREE.Vector3(0, 1, 0);
  const worldFront = new THREE.Vector3(0, 0, 1);
  const worldRight = new THREE.Vector3(1, 0, 0);

  // Rotate saw directions into local board coordinates
  const localUp = worldUp.clone().applyQuaternion(inverseQuat);
  const localFront = worldFront.clone().applyQuaternion(inverseQuat);
  const localRight = worldRight.clone().applyQuaternion(inverseQuat);

  // Cut normal in local coordinates
  const n = new THREE.Vector3(cut.normal[0], cut.normal[1], cut.normal[2]);

  // Project local normal onto local saw axes
  const n_r = n.dot(localRight);
  const n_u = n.dot(localUp);
  const n_f = n.dot(localFront);

  const sign = n_r > 0 ? 1 : -1;

  // Calculate angles in saw space
  let miterRad = Math.atan2(sign * n_f, sign * n_r);
  let miterDeg = miterRad * (180 / Math.PI);

  let bevelRad = Math.asin(n_u);
  let bevelDeg = bevelRad * (180 / Math.PI);

  // Round/snap
  const snapAngle = (angle) => {
    const roundedToHalf = Math.round(angle * 2) / 2;
    if (Math.abs(angle - roundedToHalf) < 0.1) {
      return roundedToHalf;
    }
    return parseFloat(angle.toFixed(2));
  };

  return {
    miter: snapAngle(miterDeg),
    bevel: snapAngle(bevelDeg),
  };
}

// ── Helper to calculate cut labels and distances dynamically based on orientation ────────
export function getLabelAndDist(board, cut) {
  if (!board || !cut) return { label: '', distFromLeft: 0, isFlipped: false };

  const [rx, ry, rz] = board.orientation || [0, 0, 0];
  const euler = new THREE.Euler(rx, ry, rz, 'YXZ');
  const localXDir = new THREE.Vector3(1, 0, 0).applyEuler(euler);

  const absX = Math.abs(localXDir.x);
  const absY = Math.abs(localXDir.y);
  const absZ = Math.abs(localXDir.z);

  let isFlipped = false;
  if (absX >= absY && absX >= absZ) {
    isFlipped = localXDir.x < 0;
  } else if (absY >= absX && absY >= absZ) {
    isFlipped = localXDir.y < 0;
  } else {
    isFlipped = localXDir.z < 0;
  }

  const length = board.size[0];
  const { localX } = getTopFrontIntersection(board, cut);
  const distFromLeft = isFlipped ? (length / 2 - localX) : (localX + length / 2);

  let displayLabel = cut.label;
  const atLeftEnd = Math.abs(cut.centerX - (-length / 2)) < 0.3;
  const atRightEnd = Math.abs(cut.centerX - (length / 2)) < 0.3;

  if (atLeftEnd) {
    displayLabel = isFlipped ? 'Right End' : 'Left End';
  } else if (atRightEnd) {
    displayLabel = isFlipped ? 'Left End' : 'Right End';
  }

  return { label: displayLabel, distFromLeft, isFlipped };
}
