import * as THREE from 'three';
import { Evaluator, SUBTRACTION, INTERSECTION, Brush } from 'three-bvh-csg';
import { buildTaperGeometry, normalizeTaper } from './geometryBuilders';

const csgEvaluator = new Evaluator();

// ── Shared Constants for Dado mapping ────────────────────────────────────────
const _FACE_MAP = {
  top:    { depthAxis: 1, sign: +1, faceAxes: [0, 2] },
  bottom: { depthAxis: 1, sign: -1, faceAxes: [0, 2] },
  front:  { depthAxis: 2, sign: +1, faceAxes: [0, 1] },
  back:   { depthAxis: 2, sign: -1, faceAxes: [0, 1] },
  right:  { depthAxis: 0, sign: +1, faceAxes: [1, 2] },
  left:   { depthAxis: 0, sign: -1, faceAxes: [1, 2] },
};
const _AXIS_LABELS = ['x', 'y', 'z'];

// ── Shared Builders copied from BoardRenderer.jsx to remain self-contained ───
const _buildArcTool = (size, op) => {
  const { startAngle = 0, endAngle = 90, innerRadius = 0, axis = 'y' } = op;
  const axisIdx = axis === 'x' ? 0 : axis === 'z' ? 2 : 1;
  const thickness = size[axisIdx];
  
  let dimX, dimY;
  if (axis === 'y') { dimX = size[0]; dimY = size[2]; }
  else if (axis === 'x') { dimX = size[2]; dimY = size[1]; }
  else { dimX = size[0]; dimY = size[1]; }

  const shape = new THREE.Shape();
  const startRad = THREE.MathUtils.degToRad(startAngle);
  const endRad = THREE.MathUtils.degToRad(endAngle);
  
  shape.absellipse(0, 0, dimX, dimY, startRad, endRad, false, 0);
  if (innerRadius === 0) shape.lineTo(0, 0);
  else {
    const irX = Math.max(0.01, dimX - innerRadius);
    const irY = Math.max(0.01, dimY - innerRadius);
    shape.lineTo(Math.cos(endRad) * irX, Math.sin(endRad) * irY);
    shape.absellipse(0, 0, irX, irY, endRad, startRad, true, 0);
  }
  
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 12 });
  g.computeBoundingBox();
  const center = new THREE.Vector3();
  g.boundingBox.getCenter(center);
  g.translate(-center.x, -center.y, -center.z);
  
  if (axis === 'y') g.rotateX(-Math.PI / 2);
  if (axis === 'x') g.rotateY(Math.PI / 2);
  
  g.computeBoundingBox();
  const bboxSize = new THREE.Vector3();
  g.boundingBox.getSize(bboxSize);
  g.scale(size[0] / (bboxSize.x || 1), size[1] / (bboxSize.y || 1), size[2] / (bboxSize.z || 1));
  return g;
};

const _buildCoveTool = (size, op) => {
  const { edge = 'top', depth = 2, axis = 'y' } = op;
  const axisIdx = axis === 'x' ? 0 : axis === 'z' ? 2 : 1;
  const thickness = size[axisIdx];
  let dimX, dimY;
  if (axis === 'y') { dimX = size[0]; dimY = size[2]; }
  else if (axis === 'x') { dimX = size[2]; dimY = size[1]; }
  else { dimX = size[0]; dimY = size[1]; }

  const shape = new THREE.Shape();
  if (edge === 'bottom') { shape.moveTo(0, 0); shape.absellipse(dimX / 2, 0, dimX / 2, depth, Math.PI, 0, true, 0); } else { shape.moveTo(0, 0); shape.lineTo(dimX, 0); }
  if (edge === 'right') { shape.absellipse(dimX, dimY / 2, depth, dimY / 2, -Math.PI / 2, Math.PI / 2, true, 0); } else { shape.lineTo(dimX, dimY); }
  if (edge === 'top') { shape.absellipse(dimX / 2, dimY, dimX / 2, depth, 0, Math.PI, true, 0); } else { shape.lineTo(0, dimY); }
  if (edge === 'left') { shape.absellipse(0, dimY / 2, depth, dimY / 2, Math.PI / 2, -Math.PI / 2, true, 0); } else { shape.lineTo(0, 0); }

  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 12 });
  g.translate(-dimX/2, -dimY/2, -thickness/2);
  if (axis === 'y') g.rotateX(-Math.PI / 2);
  if (axis === 'x') g.rotateY(Math.PI / 2);
  
  g.computeBoundingBox();
  const bboxSize = new THREE.Vector3();
  g.boundingBox.getSize(bboxSize);
  g.scale(size[0] / (bboxSize.x || 1), size[1] / (bboxSize.y || 1), size[2] / (bboxSize.z || 1));
  return g;
};

const _buildDadoTool = (size, op) => {
  const face = _FACE_MAP[op.face || 'top'];
  const { depthAxis, sign, faceAxes } = face;

  const depth = Math.max(0.01, op.depth ?? 0.375);
  const width = Math.max(0.01, op.width ?? 0.75);
  const offset = op.offset ?? 0;
  const lengthOffset = op.lengthOffset ?? 0;

  const dirAxis = op.direction === _AXIS_LABELS[faceAxes[1]] ? faceAxes[1] : faceAxes[0];
  const widthAxis = dirAxis === faceAxes[0] ? faceAxes[1] : faceAxes[0];

  const channelLength = (op.length ?? 0) <= 0 ? size[dirAxis] + 2 : op.length;

  const boxSize = [0, 0, 0];
  boxSize[dirAxis] = channelLength;
  boxSize[widthAxis] = width;
  boxSize[depthAxis] = depth;

  const pos = [0, 0, 0];
  pos[depthAxis] = sign * (size[depthAxis] / 2 - depth / 2);
  pos[widthAxis] = offset;
  pos[dirAxis] = lengthOffset;

  const geo = new THREE.BoxGeometry(boxSize[0], boxSize[1], boxSize[2]);
  geo.translate(pos[0], pos[1], pos[2]);
  return geo;
};

const _buildBlindHoleTool = (size, op) => {
  const face = _FACE_MAP[op.face || 'top'];
  const { depthAxis, sign, faceAxes } = face;

  const depth = Math.max(0.01, op.depth ?? 1.0);
  const radius = Math.max(0.01, op.radius ?? 0.1875);
  const offset = op.offset ?? 0;
  const offsetY = op.offsetY ?? 0;

  const fa0 = faceAxes[0];
  const fa1 = faceAxes[1];
  const spanFaceAxis = size[fa0] >= size[fa1] ? fa0 : fa1;
  const thicknessFaceAxis = spanFaceAxis === fa0 ? fa1 : fa0;

  const cyl = new THREE.CylinderGeometry(radius, radius, depth, 32);

  if (depthAxis === 0) cyl.rotateZ(Math.PI / 2);
  else if (depthAxis === 2) cyl.rotateX(Math.PI / 2);

  const pos = [0, 0, 0];
  pos[depthAxis] = sign * (size[depthAxis] / 2 - depth / 2);
  pos[spanFaceAxis] = offset;
  pos[thicknessFaceAxis] = offsetY;

  cyl.translate(pos[0], pos[1], pos[2]);
  return cyl;
};

const _buildMiterTool = (size, op) => {
  const face = op.face || 'x+';
  const fence = op.fenceEdge || 'z-';
  const angleDeg = Math.max(0, op.angle ?? 45);
  const angleRad = (angleDeg * Math.PI) / 180;
  const bevelDeg = op.bevel ?? 0;
  const bevelRad = (bevelDeg * Math.PI) / 180;

  const faceAxis = face[0] === 'x' ? 0 : face[0] === 'y' ? 1 : 2;
  const faceSign = face[1] === '+' ? 1 : -1;
  const fenceAxis = fence[0] === 'x' ? 0 : fence[0] === 'y' ? 1 : 2;
  const fenceSign = fence[1] === '+' ? 1 : -1;

  const cutterSize = Math.max(size[0], size[1], size[2]) * 4;
  const geo = new THREE.BoxGeometry(cutterSize, cutterSize, cutterSize);

  const shift = [0, 0, 0];
  shift[faceAxis] = faceSign * cutterSize / 2;
  const shiftToOrigin = new THREE.Matrix4().makeTranslation(shift[0], shift[1], shift[2]);

  let bevelMatrix = new THREE.Matrix4();
  const thicknessAxis = [0, 1, 2].find(i => i !== faceAxis && i !== fenceAxis);
  
  if (Math.abs(bevelRad) > 0.001) {
    const pivotVal = bevelDeg > 0 ? -size[thicknessAxis] / 2 : size[thicknessAxis] / 2;
    
    const tv = [0, 0, 0];
    tv[thicknessAxis] = -pivotVal;
    const toOrigin = new THREE.Matrix4().makeTranslation(tv[0], tv[1], tv[2]);
    tv[thicknessAxis] = pivotVal;
    const fromOrigin = new THREE.Matrix4().makeTranslation(tv[0], tv[1], tv[2]);
    
    let rot = new THREE.Matrix4();
    const isForward = 
      (fenceAxis === 0 && faceAxis === 1) || 
      (fenceAxis === 1 && faceAxis === 2) || 
      (fenceAxis === 2 && faceAxis === 0);
      
    const rotAngle = (isForward ? 1 : -1) * faceSign * bevelRad;
    
    if (fenceAxis === 0) rot.makeRotationX(rotAngle);
    else if (fenceAxis === 1) rot.makeRotationY(rotAngle);
    else rot.makeRotationZ(rotAngle);
    
    bevelMatrix.multiply(fromOrigin).multiply(rot).multiply(toOrigin);
  }

  let miterMatrix = new THREE.Matrix4();
  if (Math.abs(angleRad) > 0.001) {
    const rotAngle = faceSign * fenceSign * angleRad;
    if (thicknessAxis === 0) miterMatrix.makeRotationX((faceAxis === 1 ? -1 : 1) * rotAngle);
    else if (thicknessAxis === 1) miterMatrix.makeRotationY((faceAxis === 2 ? -1 : 1) * rotAngle);
    else miterMatrix.makeRotationZ((faceAxis === 0 ? -1 : 1) * rotAngle);
  }

  const pivot = [0, 0, 0];
  pivot[faceAxis] = faceSign * size[faceAxis] / 2;
  pivot[fenceAxis] = fenceSign * size[fenceAxis] / 2;
  const shiftToPivot = new THREE.Matrix4().makeTranslation(pivot[0], pivot[1], pivot[2]);

  const m = new THREE.Matrix4()
    .multiply(shiftToPivot)
    .multiply(miterMatrix)
    .multiply(bevelMatrix)
    .multiply(shiftToOrigin);

  geo.applyMatrix4(m);
  return geo;
};

const _buildEdgeProfileTool = (size, op) => {
  const { profile = 'roundover', edge = 'y+z+', radius = 0.25, width = 0.25 } = op;
  const match = edge.match(/^([xyz])([+-])([xyz])([+-])$/);
  if (!match) return new THREE.BoxGeometry(0.01, 0.01, 0.01);
  
  const a1 = match[1];
  const s1 = match[2] === '+' ? 1 : -1;
  const a2 = match[3];
  const s2 = match[4] === '+' ? 1 : -1;
  
  const axes = ['x', 'y', 'z'];
  const a1Idx = axes.indexOf(a1);
  const a2Idx = axes.indexOf(a2);
  const runIdx = [0, 1, 2].find(i => i !== a1Idx && i !== a2Idx);
  
  const p1Idx = a1Idx;
  const p2Idx = a2Idx;
  
  const vec_p1 = new THREE.Vector3();
  vec_p1.setComponent(p1Idx, 1);
  const vec_run = new THREE.Vector3();
  vec_run.setComponent(runIdx, 1);
  
  const vec_p2 = new THREE.Vector3().crossVectors(vec_run, vec_p1);
  const s_p2 = vec_p2.getComponent(p2Idx);
  const s2_adj = s2 * s_p2;
  
  const hw1 = size[p1Idx] / 2;
  const hw2 = size[p2Idx] / 2;
  const L = size[runIdx];
  const R = profile === 'roundover' ? Math.max(0.01, radius) : Math.max(0.01, width);
  
  const shape = new THREE.Shape();
  const Cx = s1 * hw1;
  const Cy = s2_adj * hw2;
  const Ax = s1 * (hw1 - R);
  const Ay = s2_adj * hw2;
  const Bx = s1 * hw1;
  const By = s2_adj * (hw2 - R);
  
  shape.moveTo(Ax, Ay);
  shape.lineTo(Cx, Cy);
  shape.lineTo(Bx, By);
  
  if (profile === 'roundover') {
    const Ox = s1 * (hw1 - R);
    const Oy = s2_adj * (hw2 - R);
    const startAngle = Math.atan2(By - Oy, Bx - Ox);
    const endAngle = Math.atan2(Ay - Oy, Ax - Ox);
    const clockwise = (s1 * s2_adj) < 0;
    shape.absarc(Ox, Oy, R, startAngle, endAngle, clockwise);
  } else {
    shape.lineTo(Ax, Ay);
  }
  
  const geom = new THREE.ExtrudeGeometry(shape, { depth: L + 2, bevelEnabled: false, curveSegments: 16 });
  geom.translate(0, 0, -(L + 2) / 2);
  
  const matrix = new THREE.Matrix4();
  matrix.set(
    vec_p1.x,  vec_p2.x,  vec_run.x,  0,
    vec_p1.y,  vec_p2.y,  vec_run.y,  0,
    vec_p1.z,  vec_p2.z,  vec_run.z,  0,
    0,         0,         0,          1
  );
  geom.applyMatrix4(matrix);
  return geom;
};

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
          opBrush = new Brush(_buildMiterTool(board.size, op));
        } else if (op.type === 'dado') {
          opBrush = new Brush(_buildDadoTool(board.size, op));
        } else if (op.type === 'edge-profile') {
          opBrush = new Brush(_buildEdgeProfileTool(board.size, op));
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
      for (const [axisKey, ops] of Object.entries(byAxis)) {
        try {
          const buildTool = (op) => {
            if (op.type === 'arc')  return new Brush(_buildArcTool(board.size, op));
            if (op.type === 'cove') return new Brush(_buildCoveTool(board.size, op));
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
