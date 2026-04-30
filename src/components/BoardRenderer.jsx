import React, { useMemo, useEffect, Suspense, useState } from 'react';
import * as THREE from 'three';
import { useTexture, useGLTF, Edges, Html, Line } from '@react-three/drei';
import useStore from '../store/useStore';
import { computeWorldAABB, collectChildBoards, calculateGroupAABB } from '../utils/sceneGraph';
import { formatUnit } from '../utils/units';
import { WOOD_CATALOGUE, WOOD_TEXTURE_URLS, normalizeMaterial } from '../utils/materialCatalogue';
import { buildTaperGeometry, normalizeTaper } from '../utils/geometryBuilders';
import { computeHardwareTransform } from '../utils/hardwareCatalogue';
import { Evaluator, SUBTRACTION, INTERSECTION, Brush } from 'three-bvh-csg';
import { computeSnapPoints, findNearestSnap } from '../utils/snapHelpers';

const csgEvaluator = new Evaluator();

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

// ── Dado / Groove / Rabbet tool builder ──────────────────────────────────────
const _FACE_MAP = {
  top:    { depthAxis: 1, sign: +1, faceAxes: [0, 2] },
  bottom: { depthAxis: 1, sign: -1, faceAxes: [0, 2] },
  front:  { depthAxis: 2, sign: +1, faceAxes: [0, 1] },
  back:   { depthAxis: 2, sign: -1, faceAxes: [0, 1] },
  right:  { depthAxis: 0, sign: +1, faceAxes: [1, 2] },
  left:   { depthAxis: 0, sign: -1, faceAxes: [1, 2] },
};
const _AXIS_LABELS = ['x', 'y', 'z'];

const _buildDadoTool = (size, op) => {
  const face = _FACE_MAP[op.face || 'top'];
  const { depthAxis, sign, faceAxes } = face;

  const depth = Math.max(0.01, op.depth ?? 0.375);
  const width = Math.max(0.01, op.width ?? 0.75);
  const offset = op.offset ?? 0;
  const lengthOffset = op.lengthOffset ?? 0;

  // Direction: which face-plane axis the channel runs along
  const dirAxis = op.direction === _AXIS_LABELS[faceAxes[1]] ? faceAxes[1] : faceAxes[0];
  const widthAxis = dirAxis === faceAxes[0] ? faceAxes[1] : faceAxes[0];

  // Channel length: 0 or missing = full through-cut
  const channelLength = (op.length ?? 0) <= 0 ? size[dirAxis] + 2 : op.length;

  // Build box dimensions
  const boxSize = [0, 0, 0];
  boxSize[dirAxis] = channelLength;
  boxSize[widthAxis] = width;
  boxSize[depthAxis] = depth;

  // Position: flush against the chosen face
  const pos = [0, 0, 0];
  pos[depthAxis] = sign * (size[depthAxis] / 2 - depth / 2);
  pos[widthAxis] = offset;
  pos[dirAxis] = lengthOffset;

  const geo = new THREE.BoxGeometry(boxSize[0], boxSize[1], boxSize[2]);
  geo.translate(pos[0], pos[1], pos[2]);
  return geo;
};

// ── Miter Saw Cut tool builder ───────────────────────────────────────────────
// The miter operation stores:
//   face      — which end to cut ('x+', 'x-', 'z+', 'z-')
//   fenceEdge — which edge of that end face the saw pivots from ('z-', 'z+', 'x-', 'x+')
//   angle     — miter degrees from square (always positive, 0–60°)
//   bevel     — bevel degrees (blade tilt from vertical, 0–45°)
//
// The fence edge stays at the measured length; the opposite edge gets shorter.
// Both face and fenceEdge are LOCAL to the board and never remapped.
//
// Compound miter: miter swings the blade around Y (turntable),
// bevel tilts the blade from vertical (motor head tilt).
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

  // 1. Position cutter so its cutting face is at the origin
  const shift = [0, 0, 0];
  shift[faceAxis] = faceSign * cutterSize / 2;
  const shiftToOrigin = new THREE.Matrix4().makeTranslation(shift[0], shift[1], shift[2]);

  // 2. Bevel rotation
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
    
    // The rotation angle must tilt the face normal towards the thickness axis.
    // Based on right-hand rule rotations in Three.js (X->Y->Z->X cycle):
    // "Forward" face axis in cycle uses positive sin, "Backward" face axis uses negative sin.
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

  // 3. Miter rotation
  let miterMatrix = new THREE.Matrix4();
  if (Math.abs(angleRad) > 0.001) {
    const rotAngle = faceSign * fenceSign * angleRad;
    if (thicknessAxis === 0) miterMatrix.makeRotationX((faceAxis === 1 ? -1 : 1) * rotAngle);
    else if (thicknessAxis === 1) miterMatrix.makeRotationY((faceAxis === 2 ? -1 : 1) * rotAngle);
    else miterMatrix.makeRotationZ((faceAxis === 0 ? -1 : 1) * rotAngle);
  }

  // 4. Translate to pivot
  const pivot = [0, 0, 0];
  pivot[faceAxis] = faceSign * size[faceAxis] / 2;
  pivot[fenceAxis] = fenceSign * size[fenceAxis] / 2;
  const shiftToPivot = new THREE.Matrix4().makeTranslation(pivot[0], pivot[1], pivot[2]);

  // Transform chain (right-to-left)
  const m = new THREE.Matrix4();
  m.multiply(shiftToPivot).multiply(miterMatrix).multiply(bevelMatrix).multiply(shiftToOrigin);
  geo.applyMatrix4(m);
  return geo;
};

const CSGGeometry = ({ b }) => {
  // Serialize only the fields that actually affect geometry.
  const targetKey = JSON.stringify({
    shape: b.shape,
    size: b.size,
    taper: b.taper,
    cylinder: b.cylinder,
    operations: b.operations,
  });

  const geo = useMemo(() => {
    const MAX_TRIS = 250000; // Safety limit — real hangs happen at millions, 250K is fine for modern GPUs
    let baseGeo;
    try {
      if (b.shape === 'taper') {
        const { angleLeft, angleRight, angleFront, angleBack } = normalizeTaper(b.taper);
        baseGeo = buildTaperGeometry(b.size[0], b.size[1], b.size[2], angleLeft, angleRight, angleFront, angleBack);
      } else if (b.shape === 'cylinder') {
        const axis = b.cylinder?.axis || 'y';
        const axisIdx = axis === 'x' ? 0 : axis === 'z' ? 2 : 1;
        const dim1 = b.size[(axisIdx + 1) % 3];
        const dim2 = b.size[(axisIdx + 2) % 3];
        const radius = Math.min(dim1, dim2) / 2;
        const height = b.size[axisIdx];
        baseGeo = new THREE.CylinderGeometry(radius, radius, height, 64, 1);
        if (axis === 'x') baseGeo.rotateZ(Math.PI / 2);
        if (axis === 'z') baseGeo.rotateX(Math.PI / 2);
      } else {
        baseGeo = new THREE.BoxGeometry(b.size[0], b.size[1], b.size[2]);
      }

      if (!b.operations || b.operations.length === 0) return baseGeo;

      // Helper: count triangles in a geometry/brush
      const triCount = (brush) => {
        const g = brush.geometry || brush;
        if (g.index) return g.index.count / 3;
        const pos = g.getAttribute?.('position');
        return pos ? pos.count / 3 : 0;
      };

      // ── CSG strategy ────────────────────────────────────────────────────────
      const activeOps = b.operations.filter(op => op.enabled !== false);
      if (activeOps.length === 0) return baseGeo;

      const subOps    = activeOps.filter(op => op.type === 'hole' || op.type === 'dado' || op.type === 'miter' || op.type === 'subtract');
      const intersOps = activeOps.filter(op => op.type === 'arc' || op.type === 'cove');

      let resultBrush = new Brush(baseGeo);
      resultBrush.updateMatrixWorld();

      // ── 1. Subtractions (holes) ────────────────────────────────────────────
      for (const op of subOps) {
        try {
          let opBrush;
          if (op.type === 'subtract') {
            // ── Boolean subtract: rebuild cutter from snapshot ──────────
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
            // Apply the stored relative transform (positions cutter in target's local space)
            if (op.relativeMatrix) {
              const m = new THREE.Matrix4().fromArray(op.relativeMatrix);
              cutterGeo.applyMatrix4(m);
            }
            opBrush = new Brush(cutterGeo);
            opBrush.updateMatrixWorld();
          } else if (op.type === 'miter') {
            opBrush = new Brush(_buildMiterTool(b.size, op));
            opBrush.updateMatrixWorld();
          } else if (op.type === 'dado') {
            opBrush = new Brush(_buildDadoTool(b.size, op));
            opBrush.updateMatrixWorld();
          } else {
            // Hole
            const axis = op.axis || 'y';
            const r = Math.max(0.01, op.radius || 1);
            const hLength = Math.max(...b.size) + 10;
            const cyl = new THREE.CylinderGeometry(r, r, hLength, 32);
            opBrush = new Brush(cyl);
            if (axis === 'x') opBrush.rotation.z = Math.PI / 2;
            else if (axis === 'z') opBrush.rotation.x = Math.PI / 2;
            const ox = op.offsetX || 0;
            const oy = op.offsetY || 0;
            if (axis === 'z') opBrush.position.set(ox, oy, 0);
            else if (axis === 'x') opBrush.position.set(0, oy, ox);
            else opBrush.position.set(ox, 0, oy);
            opBrush.updateMatrixWorld();
          }

          const prevGeometry = resultBrush.geometry;
          resultBrush = csgEvaluator.evaluate(resultBrush, opBrush, SUBTRACTION);
          resultBrush.updateMatrixWorld();
          if (prevGeometry !== baseGeo) prevGeometry?.dispose();
          opBrush.geometry?.dispose();

          // Safety check
          if (triCount(resultBrush) > MAX_TRIS) {
            console.warn(`[CSG] Triangle limit exceeded after hole op on "${b.name}" (${triCount(resultBrush)} tris). Falling back.`);
            return new THREE.BoxGeometry(b.size[0], b.size[1], b.size[2]);
          }
        } catch (e) {
          console.error('CSG hole error:', e);
        }
      }

      // ── 2. Intersections (arc / cove) — hybrid strategy ───────────────────
      //   • Same-axis ops are merged into one tool first (cheap — tools
      //     overlap cleanly on the same plane).
      //   • Then each axis group is applied sequentially to the base mesh.
      //     Each pass carves material away, keeping the mesh manageable
      //     for multi-axis cuts.
      if (intersOps.length > 0) {
        const buildTool = (op) => {
          if (op.type === 'arc')  return new Brush(_buildArcTool(b.size, op));
          if (op.type === 'cove') return new Brush(_buildCoveTool(b.size, op));
          return null;
        };

        // Group operations by axis
        const byAxis = {};
        for (const op of intersOps) {
          const a = op.axis || 'y';
          (byAxis[a] ??= []).push(op);
        }

        // Process each axis group
        for (const [axisKey, ops] of Object.entries(byAxis)) {
          try {
            // Build first tool for this axis
            let axisTool = buildTool(ops[0]);
            if (!axisTool) continue;
            axisTool.updateMatrixWorld();

            // Merge additional same-axis tools (cheap — same-plane overlap)
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

            // Apply merged axis tool to the running result
            const prevGeometry = resultBrush.geometry;
            resultBrush = csgEvaluator.evaluate(resultBrush, axisTool, INTERSECTION);
            resultBrush.updateMatrixWorld();
            if (prevGeometry !== baseGeo) prevGeometry?.dispose();
            axisTool.geometry?.dispose();

            const tris = triCount(resultBrush);
            if (tris > MAX_TRIS) {
              console.warn(`[CSG] Triangle limit exceeded after ${axisKey}-axis ops on "${b.name}" (${tris} tris). Falling back.`);
              return new THREE.BoxGeometry(b.size[0], b.size[1], b.size[2]);
            }
          } catch (e) {
            console.error(`CSG ${axisKey}-axis error on "${b.name}":`, e);
          }
        }
      }

      return resultBrush.geometry;
    } catch (e) {
      console.error('CSG base error:', e);
      // Fall back to plain box so the board is still visible
      return new THREE.BoxGeometry(b.size[0], b.size[1], b.size[2]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);


  return <primitive object={geo} attach="geometry" />;
};

const getSemanticFace = (e, b) => {
  const hasBoxFaces = !b.shape || b.shape === 'taper';
  if (hasBoxFaces && e.faceIndex !== undefined) {
    return ['x+', 'x-', 'y+', 'y-', 'z+', 'z-'][Math.floor(e.faceIndex / 2)];
  }
  // For curved geometries (cylinder/disc), convert click to local space
  // and find closest AABB plane.
  if (e.point && e.object) {
    const localPt = e.object.worldToLocal(e.point.clone());
    const hw = b.size[0] / 2;
    const hh = b.size[1] / 2;
    const hd = b.size[2] / 2;
    const dists = {
      'x+': Math.abs(hw - localPt.x),
      'x-': Math.abs(-hw - localPt.x),
      'y+': Math.abs(hh - localPt.y),
      'y-': Math.abs(-hh - localPt.y),
      'z+': Math.abs(hd - localPt.z),
      'z-': Math.abs(-hd - localPt.z),
    };
    let bestFace = null;
    let minDist = Infinity;
    for (const [face, d] of Object.entries(dists)) {
      if (d < minDist) {
        minDist = d;
        bestFace = face;
      }
    }
    return bestFace;
  }
  return null;
};

// ── Convert a local face string to its world-facing direction ────────────
// Used when storing constraint faces so the solver (which works in world
// space) snaps on the correct axis.  For unoriented boards this is identity.
const localFaceToWorld = (localFace, orientation) => {
  if (!localFace) return localFace;
  const [rx, ry, rz] = orientation || [0, 0, 0];
  if (rx === 0 && ry === 0 && rz === 0) return localFace;

  const axisIdx = localFace[0] === 'x' ? 0 : localFace[0] === 'y' ? 1 : 2;
  const sign = localFace[1] === '+' ? 1 : -1;
  const localN = [0, 0, 0];
  localN[axisIdx] = sign;

  // Three.js YXZ Euler order: a=cos(x),b=sin(x),c=cos(y),d=sin(y),e=cos(z),f=sin(z)
  const a = Math.cos(rx), b = Math.sin(rx);
  const c = Math.cos(ry), d = Math.sin(ry);
  const e = Math.cos(rz), f = Math.sin(rz);
  const ce = c*e, cf = c*f, de = d*e, df = d*f;
  // Row-major rotation matrix (from Three.js makeRotationFromEuler YXZ)
  const R = [
    [ce+df*b,  de*b-cf,  a*d ],
    [a*f,      a*e,     -b   ],
    [cf*b-de,  df+ce*b,  a*c ],
  ];
  const worldN = [
    R[0][0] * localN[0] + R[0][1] * localN[1] + R[0][2] * localN[2],
    R[1][0] * localN[0] + R[1][1] * localN[1] + R[1][2] * localN[2],
    R[2][0] * localN[0] + R[2][1] * localN[1] + R[2][2] * localN[2],
  ];

  let bestAxis = 0, bestAbs = 0;
  for (let i = 0; i < 3; i++) {
    const a2 = Math.abs(worldN[i]);
    if (a2 > bestAbs) { bestAbs = a2; bestAxis = i; }
  }
  return ['x', 'y', 'z'][bestAxis] + (worldN[bestAxis] > 0 ? '+' : '-');
};

// ── Hardware attachment renderer ─────────────────────────────────────────────
const HardwareAttachment = ({ hw, boardSize, boardId }) => {
  const { selectedHardwareId, setSelectedHardwareId, setSelectedItemIds, updateHardware } = useStore();
  const { scene } = useGLTF(hw.modelUrl);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const { position, rotation } = computeHardwareTransform(boardSize, hw.face, hw.offset);
  const isSelected = selectedHardwareId === hw.id;

  // Auto-scale on first load: if scale is still 1 and model is very small/large relative to board,
  // compute a sensible default. Models from Sketchfab are typically in meters, boards are in inches.
  useEffect(() => {
    if (hw.scale && hw.scale !== 1) return; // user already set a custom scale
    const box = new THREE.Box3().setFromObject(clonedScene);
    const modelSize = new THREE.Vector3();
    box.getSize(modelSize);
    const maxModelDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
    if (maxModelDim <= 0) return;

    // Target: hardware should be roughly 1/3 the board's smallest face dimension
    const targetSize = Math.min(...boardSize) * 0.8;
    const autoScale = targetSize / maxModelDim;

    // Only auto-adjust if the ratio is very off (model is >5x too big or too small)
    if (autoScale < 0.2 || autoScale > 5) {
      const rounded = parseFloat(autoScale.toFixed(2));
      updateHardware(boardId, hw.id, { scale: rounded });
    }
  }, [clonedScene]); // only on first load

  // Combine face rotation with user-specified rotation
  const finalRotation = [
    rotation[0] + (hw.rotation?.[0] || 0),
    rotation[1] + (hw.rotation?.[1] || 0),
    rotation[2] + (hw.rotation?.[2] || 0),
  ];

  // Apply emissive highlight when selected
  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child.isMesh && child.material) {
        const mat = child.material.clone();
        mat.emissive = new THREE.Color(isSelected ? '#bc8a5f' : '#000000');
        mat.emissiveIntensity = isSelected ? 0.6 : 0;
        child.material = mat;
      }
    });
  }, [clonedScene, isSelected]);

  return (
    <group
      position={position}
      rotation={finalRotation}
      scale={hw.scale || 1}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedItemIds([boardId.toString()]);
        setSelectedHardwareId(hw.id);
      }}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}
    >
      <primitive object={clonedScene} />
    </group>
  );
};

const BoardMesh = ({ b, selectedItemIds, toggleSelection, textures, showEdges, constraintTargetMode, hoveredFaceData, setHoveredFaceData, modifierActive }) => {
  if (b.visible === false) return null;
  const isSelected = selectedItemIds.includes(b.id.toString());

  // Pivot offset in LOCAL board space (default [0,0,0] = center)
  const pivot = b.pivot || [0, 0, 0];
  const hasPivot = pivot[0] !== 0 || pivot[1] !== 0 || pivot[2] !== 0;

  // Face labels are in LOCAL board space — orientation is handled by the mesh transform
  const faceLabels = {
    'x+': 'right', 'x-': 'left',
    'y+': 'top',   'y-': 'bottom',
    'z+': 'front', 'z-': 'back'
  };

  return (
    <group
      position={b.position}
      rotation={b.orientation ? [...b.orientation, 'YXZ'] : [0, 0, 0, 'YXZ']}
    >
      {/* Inner mesh is offset by -pivot so the board geometry rotates around the pivot */}
      <mesh
        position={[-pivot[0], -pivot[1], -pivot[2]]}
        raycast={(modifierActive && constraintTargetMode?.active) ? () => null : undefined}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();

          // ── Pivot Mode ──
          const { pivotMode, setPivotMode, gridSnap, setCustomPivot, setPivotHoverSnap } = useStore.getState();
          if (pivotMode?.active && pivotMode.boardId === b.id.toString()) {
            const gridStep = gridSnap === '1/8 in' ? 0.125 : gridSnap === '1/4 in' ? 0.25 : gridSnap === '1/2 in' ? 0.5 : gridSnap === '1 in' ? 1.0 : 0.125;
            const pt = e.point.clone();
            const euler = new THREE.Euler(...(b.orientation || [0, 0, 0]), 'YXZ');
            pt.sub(new THREE.Vector3(...b.position));
            pt.applyEuler(new THREE.Euler(-euler.x, -euler.y, -euler.z, 'ZXY'));

            const snx = Math.round(pt.x / gridStep) * gridStep;
            const sny = Math.round(pt.y / gridStep) * gridStep;
            const snz = Math.round(pt.z / gridStep) * gridStep;

            setCustomPivot(b.id, [snx, sny, snz]);
            setPivotMode(null);
            setPivotHoverSnap(null);
            useStore.getState().showToast('Pivot point set successfully.');
            return;
          }

          // ── Measure Mode: first point only ──
          const { measureMode, setMeasureMode } = useStore.getState();
          if (measureMode?.active) {
            if (!measureMode.firstPoint) {
              const hitWorld = [e.point.x, e.point.y, e.point.z];
              const snap = findNearestSnap(hitWorld, b);
              const point = snap
                ? { localOffset: snap.localOffset, boardId: b.id.toString(), snapType: snap.type }
                : { localOffset: [e.point.x - b.position[0], e.point.y - b.position[1], e.point.z - b.position[2]], boardId: b.id.toString(), snapType: 'surface' };
              setMeasureMode({ active: true, firstPoint: point });
            }
            // Second point is handled by onPointerDown (drag mode)
            return;
          }

          const localFace = getSemanticFace(e, b);
          const faceStr = localFaceToWorld(localFace, b.orientation);
          toggleSelection(b.id.toString(), e.shiftKey || e.ctrlKey || e.metaKey, faceStr);
        }}
        onPointerDown={(e) => {
          // ── Measure Mode: second point starts drag ──
          const { measureMode, setMeasureMode } = useStore.getState();
          if (measureMode?.active && measureMode.firstPoint && !measureMode.dragging) {
            e.stopPropagation();
            const hitWorld = [e.point.x, e.point.y, e.point.z];
            const snap = findNearestSnap(hitWorld, b);
            const point = snap
              ? { localOffset: snap.localOffset, boardId: b.id.toString(), snapType: snap.type }
              : { localOffset: [e.point.x - b.position[0], e.point.y - b.position[1], e.point.z - b.position[2]], boardId: b.id.toString(), snapType: 'surface' };

            // Prevent zero-length
            const fp = measureMode.firstPoint;
            if (fp.boardId === point.boardId &&
                Math.abs(fp.localOffset[0] - point.localOffset[0]) < 0.1 &&
                Math.abs(fp.localOffset[1] - point.localOffset[1]) < 0.1 &&
                Math.abs(fp.localOffset[2] - point.localOffset[2]) < 0.1) {
              setMeasureMode({ active: true, firstPoint: null });
              return;
            }

            // Compute offset direction: perpendicular to measurement line
            // Use camera forward crossed with measurement direction for a natural perpendicular
            const fpBoard = useStore.getState().boards.find(x => x.id.toString() === fp.boardId);
            if (!fpBoard) return;
            const euler1 = new THREE.Euler(...(fpBoard.orientation || [0, 0, 0]), 'YXZ');
            const pivot1 = fpBoard.pivot || [0, 0, 0];
            const pt1 = new THREE.Vector3(fp.localOffset[0]-pivot1[0], fp.localOffset[1]-pivot1[1], fp.localOffset[2]-pivot1[2]);
            pt1.applyEuler(euler1);
            const wA = new THREE.Vector3(pt1.x+fpBoard.position[0], pt1.y+fpBoard.position[1], pt1.z+fpBoard.position[2]);

            const euler2 = new THREE.Euler(...(b.orientation || [0, 0, 0]), 'YXZ');
            const pivot2 = b.pivot || [0, 0, 0];
            const pt2 = new THREE.Vector3(point.localOffset[0]-pivot2[0], point.localOffset[1]-pivot2[1], point.localOffset[2]-pivot2[2]);
            pt2.applyEuler(euler2);
            const wB = new THREE.Vector3(pt2.x+b.position[0], pt2.y+b.position[1], pt2.z+b.position[2]);

            const measDir = new THREE.Vector3().subVectors(wB, wA).normalize();
            // OffsetDirA: world-axis perpendicular (default drag direction)
            let offsetDirA;
            if (Math.abs(measDir.y) > 0.9) {
              offsetDirA = Math.abs(measDir.x) < Math.abs(measDir.z)
                ? new THREE.Vector3(1, 0, 0)
                : new THREE.Vector3(0, 0, 1);
            } else {
              offsetDirA = new THREE.Vector3(0, 1, 0);
            }

            // OffsetDirB: face normal of the clicked board (perpendicular to face)
            let offsetDirB = new THREE.Vector3(0, 1, 0); // fallback
            if (e.face && e.face.normal) {
              // Transform local face normal to world space using the board's rotation
              offsetDirB = e.face.normal.clone().applyEuler(euler2).normalize();
            }
            // Ensure it's not parallel to the measurement direction
            if (Math.abs(offsetDirB.dot(measDir)) > 0.95) {
              offsetDirB = offsetDirA.clone(); // fallback to axis perpendicular
            }

            setMeasureMode({
              active: true,
              firstPoint: measureMode.firstPoint,
              secondPoint: point,
              dragging: true,
              dragOffset: 0,
              offsetDir: [offsetDirA.x, offsetDirA.y, offsetDirA.z],
              offsetDirA: [offsetDirA.x, offsetDirA.y, offsetDirA.z],
              offsetDirB: [offsetDirB.x, offsetDirB.y, offsetDirB.z],
            });
          }
        }}
        onPointerMove={(e) => {
          // ── Pivot Mode hover snap tracking ──
          const { pivotMode, setPivotHoverSnap, gridSnap } = useStore.getState();
          if (pivotMode?.active && pivotMode.boardId === b.id.toString()) {
            e.stopPropagation();
            const gridStep = gridSnap === '1/8 in' ? 0.125 : gridSnap === '1/4 in' ? 0.25 : gridSnap === '1/2 in' ? 0.5 : gridSnap === '1 in' ? 1.0 : 0.125;
            const pt = e.point.clone();
            const euler = new THREE.Euler(...(b.orientation || [0, 0, 0]), 'YXZ');
            pt.sub(new THREE.Vector3(...b.position));
            pt.applyEuler(new THREE.Euler(-euler.x, -euler.y, -euler.z, 'ZXY'));

            const snx = Math.round(pt.x / gridStep) * gridStep;
            const sny = Math.round(pt.y / gridStep) * gridStep;
            const snz = Math.round(pt.z / gridStep) * gridStep;

            const worldPt = new THREE.Vector3(snx, sny, snz);
            worldPt.applyEuler(euler);
            worldPt.add(new THREE.Vector3(...b.position));

            setPivotHoverSnap([worldPt.x, worldPt.y, worldPt.z]);
            return;
          }

          // ── Hover snap tracking for measure mode ──
          const { measureMode: mm, setMeasureHoverSnap, measureHoverSnap } = useStore.getState();
          if (mm?.active && !mm.dragging) {
            e.stopPropagation();
            const hitWorld = [e.point.x, e.point.y, e.point.z];
            const snap = findNearestSnap(hitWorld, b);
            if (snap) {
              // Only update if different snap point
              if (!measureHoverSnap ||
                  measureHoverSnap.boardId !== b.id.toString() ||
                  measureHoverSnap.localOffset[0] !== snap.localOffset[0] ||
                  measureHoverSnap.localOffset[1] !== snap.localOffset[1] ||
                  measureHoverSnap.localOffset[2] !== snap.localOffset[2]) {
                setMeasureHoverSnap({ ...snap, boardId: b.id.toString() });
              }
            } else if (measureHoverSnap && measureHoverSnap.boardId === b.id.toString()) {
              setMeasureHoverSnap(null);
            }
          }

          const isActiveMode = constraintTargetMode && constraintTargetMode.active;
          if (isSelected || isActiveMode) {
            e.stopPropagation();
            const fStr = getSemanticFace(e, b);
            if (fStr && (!hoveredFaceData || hoveredFaceData.id !== b.id.toString() || hoveredFaceData.faceStr !== fStr)) {
              setHoveredFaceData({ id: b.id.toString(), faceStr: fStr });
            }
          }
        }}
        onPointerOut={(e) => {
          // Clear measure and pivot hover snap when leaving this board
          const { measureMode: mm, setMeasureHoverSnap, pivotMode, setPivotHoverSnap } = useStore.getState();
          if (mm?.active) setMeasureHoverSnap(null);
          if (pivotMode?.active) setPivotHoverSnap(null);
          if (hoveredFaceData && hoveredFaceData.id === b.id.toString()) {
            setHoveredFaceData(null);
          }
        }}
      >
        <CSGGeometry b={b} />
        {(() => {
          const matDesc = normalizeMaterial(b.material);
          const matKey = matDesc.type === 'color' ? `color-${matDesc.hex}` : `wood-${matDesc.id}`;
          const commonProps = {
            emissive: isSelected ? '#bc8a5f' : '#000000',
            emissiveIntensity: isSelected ? 0.4 : 0,
          };
          if (matDesc.type === 'color') {
            return (
              <meshStandardMaterial
                key={matKey}
                color={matDesc.hex}
                roughness={0.85}
                {...commonProps}
              />
            );
          }
          const spec = WOOD_CATALOGUE[matDesc.id] ?? WOOD_CATALOGUE['pine'];
          return (
            <meshStandardMaterial
              key={matKey}
              color="#ffffff"
              map={textures[matDesc.id] ?? textures['pine']}
              roughness={spec.roughness}
              {...commonProps}
            />
          );
        })()}
        {showEdges && <Edges scale={1} threshold={15} color={isSelected ? '#ffffff' : '#222222'} />}
        {/* Axes helper on the mesh (at board center, not pivot) */}
        {isSelected && <axesHelper args={[Math.max(...b.size) * 0.75 + 2.25]} />}
        {((isSelected || (constraintTargetMode && constraintTargetMode.active)) && hoveredFaceData && hoveredFaceData.id === b.id.toString()) && (() => {
          const faceStr = hoveredFaceData.faceStr;
          if (!faceStr) return null;
          let pos = [0, 0, 0], rot = [0, 0, 0];
          const w = b.size[0] / 2 + 0.01;
          const h = b.size[1] / 2 + 0.01;
          const d = b.size[2] / 2 + 0.01;
          if (faceStr === 'x+') { pos = [w, 0, 0]; rot = [0, Math.PI / 2, 0]; }
          if (faceStr === 'x-') { pos = [-w, 0, 0]; rot = [0, -Math.PI / 2, 0]; }
          if (faceStr === 'y+') { pos = [0, h, 0]; rot = [-Math.PI / 2, 0, 0]; }
          if (faceStr === 'y-') { pos = [0, -h, 0]; rot = [Math.PI / 2, 0, 0]; }
          if (faceStr === 'z+') { pos = [0, 0, d]; rot = [0, 0, 0]; }
          if (faceStr === 'z-') { pos = [0, 0, -d]; rot = [0, Math.PI, 0]; }
          
          let planeW = faceStr.startsWith('x') ? b.size[2] : b.size[0];
          let planeH = faceStr.startsWith('y') ? b.size[2] : b.size[1];
          if (faceStr.startsWith('x')) planeH = b.size[1];
          if (faceStr.startsWith('z')) planeH = b.size[1];

          const tooltipLabel = faceLabels[faceStr] || faceStr;

          return (
            <group>
              <mesh position={pos} rotation={rot} raycast={() => null}>
                <planeGeometry args={[planeW, planeH]} />
                <meshBasicMaterial color="#00ffff" transparent opacity={0.4} depthTest={false} side={THREE.DoubleSide} />
              </mesh>
              <Html position={pos} center style={{ pointerEvents: 'none', zIndex: 10 }}>
                <div style={{
                  background: 'rgba(0, 0, 0, 0.75)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                }}>
                  {tooltipLabel}
                </div>
              </Html>
            </group>
          );
        })()}
        {/* ── Hardware attachments ─────────────────────────────────────────── */}
        {(b.hardware || []).length > 0 && (
          <Suspense fallback={null}>
            {(b.hardware || []).map(hw => (
              <HardwareAttachment key={hw.id} hw={hw} boardSize={b.size} boardId={b.id} />
            ))}
          </Suspense>
        )}
      </mesh>

      {/* ── Pivot Visualizer ───────────────────────────────────────────────── */}
      {/* Shown when board is selected and pivot is not at center.              */}
      {/* The pivot point is at the group origin (0,0,0); the board center     */}
      {/* is at (-pivot). We draw a sphere at origin and a dashed line to it.  */}
      {isSelected && hasPivot && (
        <group>
          {/* Pivot sphere — magenta, always visible */}
          <mesh raycast={() => null}>
            <sphereGeometry args={[0.35, 16, 16]} />
            <meshBasicMaterial color="#ff00ff" transparent opacity={0.85} depthTest={false} />
          </mesh>
          {/* Dashed line from pivot to board center */}
          <Line
            points={[[0, 0, 0], [-pivot[0], -pivot[1], -pivot[2]]]}
            color="#ff00ff"
            lineWidth={2}
            dashed
            dashScale={8}
            dashSize={1}
            dashOffset={0}
          />
          {/* Pivot label */}
          <Html center style={{ pointerEvents: 'none' }}>
            <div style={{
              background: 'rgba(180, 0, 180, 0.8)',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '10px',
              fontSize: '0.65rem',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              transform: 'translateY(-14px)',
            }}>
              ⊕ Pivot
            </div>
          </Html>
        </group>
      )}
    </group>
  );
};

const RecursiveNode = ({ nodeId, groups, boards, selectedItemIds, toggleSelection, textures, showEdges, constraintTargetMode, hoveredFaceData, setHoveredFaceData, modifierActive }) => {
  const isGroup = groups[nodeId] !== undefined;

  if (!isGroup) {
    const b = boards.find(x => x.id.toString() === nodeId);
    if (!b) return null;
    return (
      <BoardMesh
        b={b}
        selectedItemIds={selectedItemIds}
        toggleSelection={toggleSelection}
        textures={textures}
        showEdges={showEdges}
        constraintTargetMode={constraintTargetMode}
        hoveredFaceData={hoveredFaceData}
        setHoveredFaceData={setHoveredFaceData}
        modifierActive={modifierActive}
      />
    );
  }

  const g = groups[nodeId];
  if (g.visible === false) return null;

  const childGroups = Object.keys(groups).filter(k => groups[k].parentId === nodeId);
  const childBoards = boards.filter(b => b.parentId === nodeId);

  // Group proxy bounding box for constraint targeting
  let groupProxyBounds = null;
  if (constraintTargetMode?.active) {
    groupProxyBounds = calculateGroupAABB(nodeId, boards, groups);
  }

  return (
    <group>
      {groupProxyBounds && (
        <mesh
          position={[groupProxyBounds.centerX, groupProxyBounds.centerY, groupProxyBounds.centerZ]}
          raycast={!modifierActive ? () => null : undefined}
          onClick={(e) => {
            if (!modifierActive) return;
            e.stopPropagation();
            const faceStr = e.faceIndex !== undefined ? ['x+', 'x-', 'y+', 'y-', 'z+', 'z-'][Math.floor(e.faceIndex / 2)] : null;
            toggleSelection(nodeId, e.shiftKey || e.ctrlKey || e.metaKey, faceStr);
          }}
          onPointerMove={(e) => {
            if (!modifierActive) return;
            e.stopPropagation();
            if (e.faceIndex !== undefined) {
              const fStr = ['x+', 'x-', 'y+', 'y-', 'z+', 'z-'][Math.floor(e.faceIndex / 2)];
              if (!hoveredFaceData || hoveredFaceData.id !== nodeId || hoveredFaceData.faceStr !== fStr) {
                setHoveredFaceData({ id: nodeId, faceStr: fStr });
              }
            }
          }}
          onPointerOut={(e) => {
            if (hoveredFaceData && hoveredFaceData.id === nodeId) {
              setHoveredFaceData(null);
            }
          }}
        >
          <boxGeometry args={[groupProxyBounds.width + 0.05, groupProxyBounds.height + 0.05, groupProxyBounds.depth + 0.05]} />
          <meshBasicMaterial color="#bc8a5f" transparent opacity={modifierActive ? 0.3 : 0} depthTest={false} wireframe={true} />
          
          {(modifierActive && hoveredFaceData && hoveredFaceData.id === nodeId) && (() => {
             const faceStr = hoveredFaceData.faceStr;
             let pos = [0, 0, 0], rot = [0, 0, 0];
             const w = groupProxyBounds.width / 2 + 0.05;
             const h = groupProxyBounds.height / 2 + 0.05;
             const d = groupProxyBounds.depth / 2 + 0.05;
             if (faceStr === 'x+') { pos = [w, 0, 0]; rot = [0, Math.PI / 2, 0]; }
             if (faceStr === 'x-') { pos = [-w, 0, 0]; rot = [0, -Math.PI / 2, 0]; }
             if (faceStr === 'y+') { pos = [0, h, 0]; rot = [-Math.PI / 2, 0, 0]; }
             if (faceStr === 'y-') { pos = [0, -h, 0]; rot = [Math.PI / 2, 0, 0]; }
             if (faceStr === 'z+') { pos = [0, 0, d]; rot = [0, 0, 0]; }
             if (faceStr === 'z-') { pos = [0, 0, -d]; rot = [0, Math.PI, 0]; }
             
             let planeW = faceStr.startsWith('x') ? groupProxyBounds.depth : groupProxyBounds.width;
             let planeH = faceStr.startsWith('y') ? groupProxyBounds.depth : groupProxyBounds.height;
             if (faceStr.startsWith('x')) planeH = groupProxyBounds.height;
             if (faceStr.startsWith('z')) planeH = groupProxyBounds.height;
             return (
               <mesh position={pos} rotation={rot} raycast={() => null}>
                 <planeGeometry args={[planeW, planeH]} />
                 <meshBasicMaterial color="#bc8a5f" transparent opacity={0.6} depthTest={false} side={THREE.DoubleSide} />
               </mesh>
             );
          })()}
        </mesh>
      )}

      {childGroups.map(k => (
        <RecursiveNode key={k} nodeId={k} groups={groups} boards={boards} selectedItemIds={selectedItemIds} toggleSelection={toggleSelection} textures={textures} showEdges={showEdges} constraintTargetMode={constraintTargetMode} hoveredFaceData={hoveredFaceData} setHoveredFaceData={setHoveredFaceData} modifierActive={modifierActive} />
      ))}
      {childBoards.map(b => (
        <RecursiveNode key={`b_${b.id}`} nodeId={b.id.toString()} groups={groups} boards={boards} selectedItemIds={selectedItemIds} toggleSelection={toggleSelection} textures={textures} showEdges={showEdges} constraintTargetMode={constraintTargetMode} hoveredFaceData={hoveredFaceData} setHoveredFaceData={setHoveredFaceData} modifierActive={modifierActive} />
      ))}
    </group>
  );
};

function WoodJoint({ boards, groups, selectedItemIds, toggleSelection, showEdges, showMeasurements, measurements, showBoundingBox, units, theme, constraintTargetMode, hoveredFaceData, setHoveredFaceData, modifierActive, constraints, measureMode }) {
  // WOOD_TEXTURE_URLS is a stable module-level object — safe to pass to useTexture()
  const textures = useTexture(WOOD_TEXTURE_URLS);

  Object.values(textures).forEach(t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  });

  const rootGroups = Object.keys(groups).filter(k => groups[k].parentId === null);
  const rootBoards = boards.filter(b => b.parentId === 'Workspace');

  // Orphaned boards: parentId references a group that doesn't exist in the groups map.
  // Render them as root-level boards so they're never invisible.
  const allGroupIds = new Set(Object.keys(groups));
  allGroupIds.add('Workspace');
  const orphanedBoards = boards.filter(b => !allGroupIds.has(b.parentId));

  return (
    <group>
      {rootGroups.map(k => (
        <RecursiveNode key={k} nodeId={k} groups={groups} boards={boards} selectedItemIds={selectedItemIds} toggleSelection={toggleSelection} textures={textures} showEdges={showEdges} constraintTargetMode={constraintTargetMode} hoveredFaceData={hoveredFaceData} setHoveredFaceData={setHoveredFaceData} modifierActive={modifierActive} />
      ))}
      {rootBoards.map(b => (
        <BoardMesh key={`root_${b.id}`} b={b} selectedItemIds={selectedItemIds} toggleSelection={toggleSelection} textures={textures} showEdges={showEdges} constraintTargetMode={constraintTargetMode} hoveredFaceData={hoveredFaceData} setHoveredFaceData={setHoveredFaceData} modifierActive={modifierActive} />
      ))}
      {orphanedBoards.map(b => (
        <BoardMesh key={`orphan_${b.id}`} b={b} selectedItemIds={selectedItemIds} toggleSelection={toggleSelection} textures={textures} showEdges={showEdges} constraintTargetMode={constraintTargetMode} hoveredFaceData={hoveredFaceData} setHoveredFaceData={setHoveredFaceData} modifierActive={modifierActive} />
      ))}
    </group>
  );
}

export default WoodJoint;
