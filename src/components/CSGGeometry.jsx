import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Evaluator, SUBTRACTION, INTERSECTION, Brush } from 'three-bvh-csg';
import {
  buildTaperGeometry,
  normalizeTaper,
  buildArcTool,
  buildCoveTool,
  buildDadoTool,
  buildBlindHoleTool,
  buildMiterTool,
  buildEdgeProfileTool
} from '../utils/geometryBuilders';

const csgEvaluator = new Evaluator();

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

      const subOps    = activeOps.filter(op => op.type === 'hole' || op.type === 'dado' || op.type === 'miter' || op.type === 'subtract' || op.type === 'edge-profile' || op.type === 'pocket-holes' || op.type === 'dowel-holes');
      const intersOps = activeOps.filter(op => op.type === 'arc' || op.type === 'cove');

      let resultBrush = new Brush(baseGeo);
      resultBrush.updateMatrixWorld();

      // ── 1. Subtractions (holes / dados / miter / profiles / fasteners) ──────
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
            opBrush = new Brush(buildMiterTool(b.size, op));
            opBrush.updateMatrixWorld();
          } else if (op.type === 'dado') {
            opBrush = new Brush(buildDadoTool(b.size, op));
            opBrush.updateMatrixWorld();
          } else if (op.type === 'edge-profile') {
            opBrush = new Brush(buildEdgeProfileTool(b.size, op));
            opBrush.updateMatrixWorld();
          } else if (op.type === 'pocket-holes') {
            const { face = 'bottom', edge = 'left', count = 2, spacing = 'auto' } = op;
            const faceMap = {
              top:    { idx: 1, sign: 1 },
              bottom: { idx: 1, sign: -1 },
              front:  { idx: 2, sign: 1 },
              back:   { idx: 2, sign: -1 },
              right:  { idx: 0, sign: 1 },
              left:   { idx: 0, sign: -1 }
            };
            const f = faceMap[face] || faceMap.bottom;
            const faceIdx = f.idx;
            const faceSign = f.sign;

            const edgeMap = {
              top:    { idx: 1, sign: 1 },
              bottom: { idx: 1, sign: -1 },
              front:  { idx: 2, sign: 1 },
              back:   { idx: 2, sign: -1 },
              right:  { idx: 0, sign: 1 },
              left:   { idx: 0, sign: -1 }
            };
            const e = edgeMap[edge] || edgeMap.left;
            const edgeIdx = e.idx;
            const edgeSign = e.sign;

            const spaceIdx = [0, 1, 2].find(i => i !== faceIdx && i !== edgeIdx);
            if (spaceIdx !== undefined) {
              const thickness = b.size[faceIdx];
              const width = b.size[spaceIdx];

              const coords = [];
              if (count === 1) {
                coords.push(0);
              } else {
                if (spacing === 'auto') {
                  const margin = Math.min(2.0, width / 4);
                  const span = width - 2 * margin;
                  for (let i = 0; i < count; i++) {
                    coords.push(-span / 2 + i * (span / (count - 1)));
                  }
                } else {
                  const s = Math.max(0.5, parseFloat(spacing) || 2);
                  const span = (count - 1) * s;
                  for (let i = 0; i < count; i++) {
                    coords.push(-span / 2 + i * s);
                  }
                }
              }

              const theta = 15 * Math.PI / 180;
              const u = new THREE.Vector3(0, Math.sin(theta), -Math.cos(theta));
              const L_pilot = 0.8;
              const L_pocket = 2.0;

              for (const x_space of coords) {
                const pilotCyl = new THREE.CylinderGeometry(0.08, 0.08, L_pilot, 16);
                pilotCyl.rotateX(-75 * Math.PI / 180);
                const P_exit = new THREE.Vector3(0, -thickness / 2, 0);
                const pilotCenter = P_exit.clone().addScaledVector(u, L_pilot / 2);
                pilotCyl.translate(pilotCenter.x, pilotCenter.y, pilotCenter.z);

                const pocketCyl = new THREE.CylinderGeometry(0.1875, 0.1875, L_pocket, 16);
                pocketCyl.rotateX(-75 * Math.PI / 180);
                const pocketCenter = P_exit.clone().addScaledVector(u, L_pilot + L_pocket / 2);
                pocketCyl.translate(pocketCenter.x, pocketCenter.y, pocketCenter.z);

                const v_y_vec = new THREE.Vector3();
                v_y_vec.setComponent(faceIdx, faceSign);

                const v_z_vec = new THREE.Vector3();
                v_z_vec.setComponent(edgeIdx, edgeSign);

                // Use cross product to ensure a right-handed coordinate system (determinant = +1).
                // This prevents mirror reflection rendering issues and CSG subtraction bugs when directions change.
                const v_x_vec = new THREE.Vector3().crossVectors(v_y_vec, v_z_vec);

                const matrix = new THREE.Matrix4();
                matrix.set(
                  v_x_vec.x, v_y_vec.x, v_z_vec.x, 0,
                  v_x_vec.y, v_y_vec.y, v_z_vec.y, 0,
                  v_x_vec.z, v_y_vec.z, v_z_vec.z, 0,
                  0,         0,         0,         1
                );

                pilotCyl.applyMatrix4(matrix);
                pocketCyl.applyMatrix4(matrix);

                const pos = [0, 0, 0];
                pos[spaceIdx] = x_space;
                pos[faceIdx] = faceSign * b.size[faceIdx] / 2;
                pos[edgeIdx] = edgeSign * b.size[edgeIdx] / 2;

                pilotCyl.translate(pos[0], pos[1], pos[2]);
                pocketCyl.translate(pos[0], pos[1], pos[2]);

                const pilotBrush = new Brush(pilotCyl);
                pilotBrush.updateMatrixWorld();
                const prevGeo1 = resultBrush.geometry;
                resultBrush = csgEvaluator.evaluate(resultBrush, pilotBrush, SUBTRACTION);
                resultBrush.updateMatrixWorld();
                if (prevGeo1 !== baseGeo) prevGeo1?.dispose();
                pilotBrush.geometry?.dispose();

                const pocketBrush = new Brush(pocketCyl);
                pocketBrush.updateMatrixWorld();
                const prevGeo2 = resultBrush.geometry;
                resultBrush = csgEvaluator.evaluate(resultBrush, pocketBrush, SUBTRACTION);
                resultBrush.updateMatrixWorld();
                if (prevGeo2 !== baseGeo) prevGeo2?.dispose();
                pocketBrush.geometry?.dispose();
              }
            }
            continue;
          } else if (op.type === 'dowel-holes') {
            const { face = 'top', count = 2, depth = 0.75, spacing = 'auto' } = op;
            const diameter = op.diameter ?? (op.radius ? op.radius * 2 : 0.375);
            const radius = diameter / 2;
            const faceMap = {
              top:    { idx: 1, sign: 1 },
              bottom: { idx: 1, sign: -1 },
              front:  { idx: 2, sign: 1 },
              back:   { idx: 2, sign: -1 },
              right:  { idx: 0, sign: 1 },
              left:   { idx: 0, sign: -1 }
            };
            const f = faceMap[face] || faceMap.top;
            const faceIdx = f.idx;
            const faceSign = f.sign;

            const fa1 = (faceIdx + 1) % 3;
            const fa2 = (faceIdx + 2) % 3;
            const thinIdx = b.size[fa1] < b.size[fa2] ? fa1 : fa2;
            const wideIdx = thinIdx === fa1 ? fa2 : fa1;

            const W = b.size[wideIdx];

            const coords = [];
            if (count === 1) {
              coords.push(0);
            } else {
              if (spacing === 'auto') {
                const margin = Math.min(2.0, W / 4);
                const span = W - 2 * margin;
                for (let i = 0; i < count; i++) {
                  coords.push(-span / 2 + i * (span / (count - 1)));
                }
              } else {
                const s = Math.max(0.5, parseFloat(spacing) || 2);
                const span = (count - 1) * s;
                for (let i = 0; i < count; i++) {
                  coords.push(-span / 2 + i * s);
                }
              }
            }

            for (const x_wide of coords) {
              const cyl = new THREE.CylinderGeometry(radius, radius, depth, 32);
              if (faceIdx === 0) cyl.rotateZ(Math.PI / 2);
              else if (faceIdx === 2) cyl.rotateX(Math.PI / 2);

              const pos = [0, 0, 0];
              pos[thinIdx] = 0;
              pos[wideIdx] = x_wide;
              pos[faceIdx] = faceSign * (b.size[faceIdx] / 2 - depth / 2);

              cyl.translate(pos[0], pos[1], pos[2]);

              const opBrush = new Brush(cyl);
              opBrush.updateMatrixWorld();
              const prevGeometry = resultBrush.geometry;
              resultBrush = csgEvaluator.evaluate(resultBrush, opBrush, SUBTRACTION);
              resultBrush.updateMatrixWorld();
              if (prevGeometry !== baseGeo) prevGeometry?.dispose();
              opBrush.geometry?.dispose();
            }
            continue;
          } else {
            // Hole (supports both blind face-aligned holes and standard through-holes)
            let cylGeo;
            if (op.depth !== undefined && op.face !== undefined) {
              cylGeo = buildBlindHoleTool(b.size, op);
            } else {
              const axis = op.axis || 'y';
              const r = Math.max(0.01, op.radius || 1);
              const hLength = Math.max(...b.size) + 10;
              cylGeo = new THREE.CylinderGeometry(r, r, hLength, 32);
              if (axis === 'x') cylGeo.rotateZ(Math.PI / 2);
              else if (axis === 'z') cylGeo.rotateX(Math.PI / 2);
              const ox = op.offsetX || 0;
              const oy = op.offsetY || 0;
              const pos = [0, 0, 0];
              if (axis === 'z') { pos[0] = ox; pos[1] = oy; }
              else if (axis === 'x') { pos[1] = oy; pos[2] = ox; }
              else { pos[0] = ox; pos[2] = oy; }
              cylGeo.translate(pos[0], pos[1], pos[2]);
            }
            opBrush = new Brush(cylGeo);
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
          if (op.type === 'arc')  return new Brush(buildArcTool(b.size, op));
          if (op.type === 'cove') return new Brush(buildCoveTool(b.size, op));
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

export default CSGGeometry;
