import * as THREE from 'three';

// ── 4-Sided Independent Taper ───────────────────────────────────────────────
//
// Each side of the taper has its own angle (degrees).  The TOP face (Y+) is
// always the full-size rectangle at X × Z.  Each side tilts inward from top
// to bottom independently.
//
//   angleLeft   → left  face (X−) tilts inward at bottom
//   angleRight  → right face (X+) tilts inward at bottom
//   angleFront  → front face (Z+) tilts inward at bottom
//   angleBack   → back  face (Z−) tilts inward at bottom
//
// Bottom dimensions:
//   X' = X − h·tan(angleLeft) − h·tan(angleRight)
//   Z' = Z − h·tan(angleFront) − h·tan(angleBack)

/**
 * Normalise any taper format to the 4-angle model.
 * New format { angleLeft, angleRight, angleFront, angleBack } passes through.
 * Legacy format { outerCorner, angleZ, angleX } is mapped to 4-angle.
 *
 * @param {object} taper
 * @returns {{ angleLeft: number, angleRight: number, angleFront: number, angleBack: number }}
 */
export function normalizeTaper(taper = {}) {
    // ── New 4-angle format ────────────────────────────────────────────────
    if ('angleLeft' in taper || 'angleRight' in taper ||
        'angleFront' in taper || 'angleBack' in taper) {
        return {
            angleLeft:  taper.angleLeft  ?? 0,
            angleRight: taper.angleRight ?? 0,
            angleFront: taper.angleFront ?? 0,
            angleBack:  taper.angleBack  ?? 0,
        };
    }

    // ── Legacy outerCorner format ─────────────────────────────────────────
    const az = taper.angleZ ?? taper['z-'] ?? 0;
    const ax = taper.angleX ?? taper['x+'] ?? 0;
    const corner = taper.outerCorner ?? 'fl';

    switch (corner) {
        case 'fl': return { angleLeft: 0,  angleRight: ax, angleFront: 0,  angleBack: az };
        case 'fr': return { angleLeft: ax, angleRight: 0,  angleFront: 0,  angleBack: az };
        case 'bl': return { angleLeft: 0,  angleRight: ax, angleFront: az, angleBack: 0  };
        case 'br': return { angleLeft: ax, angleRight: 0,  angleFront: az, angleBack: 0  };
        default:   return { angleLeft: 0,  angleRight: ax, angleFront: 0,  angleBack: az };
    }
}

/**
 * Validate taper angles against actual board dimensions.
 * Returns the remaining (bottom) width and depth plus warning strings.
 *
 * @param {number} w   board size[0] (bounding box width, X)
 * @param {number} h   board size[1] (bounding box height, Y)
 * @param {number} d   board size[2] (bounding box depth, Z)
 * @param {number} aL  left  angle (°)
 * @param {number} aR  right angle (°)
 * @param {number} aF  front angle (°)
 * @param {number} aB  back  angle (°)
 * @returns {{ xBottom: number, zBottom: number, xWarn: string|null, zWarn: string|null }}
 */
export function taperValidation(w, h, d, aL, aR, aF, aB) {
    const tapL = h * Math.tan((aL * Math.PI) / 180);
    const tapR = h * Math.tan((aR * Math.PI) / 180);
    const tapF = h * Math.tan((aF * Math.PI) / 180);
    const tapB = h * Math.tan((aB * Math.PI) / 180);
    const xBottom = +(w - tapL - tapR).toFixed(4);
    const zBottom = +(d - tapF - tapB).toFixed(4);
    return {
        xBottom,
        zBottom,
        xWarn: xBottom <= 0 ? `X taper too steep — bottom width would be ${xBottom}"` : null,
        zWarn: zBottom <= 0 ? `Z taper too steep — bottom depth would be ${zBottom}"` : null,
    };
}

/**
 * Build a tapered-box BufferGeometry from 4 independent side angles.
 *
 * The TOP face is always the full-size X × Z rectangle.
 * Each side tilts inward from top to bottom at its own angle.
 *
 * The bounding box (w × h × d) remains intact — no corner exceeds it —
 * so all Flush/Glue constraints work unchanged on the AABB.
 *
 * Uses non-indexed geometry (24 vertices = 4 per face) for sharp flat-shaded edges.
 *
 * @param {number} w   Full width  (X) — bounding box
 * @param {number} h   Full height (Y) — bounding box
 * @param {number} d   Full depth  (Z) — bounding box
 * @param {number} aL  Left  angle (°)  default 0
 * @param {number} aR  Right angle (°)  default 0
 * @param {number} aF  Front angle (°)  default 0
 * @param {number} aB  Back  angle (°)  default 0
 * @returns {THREE.BufferGeometry}
 */
export function buildTaperGeometry(w, h, d, aL = 0, aR = 0, aF = 0, aB = 0) {
    const tapL = h * Math.tan((aL * Math.PI) / 180);
    const tapR = h * Math.tan((aR * Math.PI) / 180);
    const tapF = h * Math.tan((aF * Math.PI) / 180);
    const tapB = h * Math.tan((aB * Math.PI) / 180);
    const hw = w / 2, hh = h / 2, hd = d / 2;

    // Top corners — full-size rectangle, always the same
    const TFL = [-hw,         +hh,  +hd        ];
    const TFR = [+hw,         +hh,  +hd        ];
    const TBL = [-hw,         +hh,  -hd        ];
    const TBR = [+hw,         +hh,  -hd        ];

    // Bottom corners — each side tapers independently
    const BFL = [-hw + tapL,  -hh,  +hd - tapF ];
    const BFR = [+hw - tapR,  -hh,  +hd - tapF ];
    const BBL = [-hw + tapL,  -hh,  -hd + tapB ];
    const BBR = [+hw - tapR,  -hh,  -hd + tapB ];

    // 6 faces × 4 vertices (wound CCW from outside) → 24 verts, 12 triangles
    // IMPORTANT: face order must match Three.js BoxGeometry so that
    //   Math.floor(faceIndex / 2) → [x+, x-, y+, y-, z+, z-]
    // reads correctly in the viewport face-picker.
    const quads = [
        { verts: [BFR, BBR, TBR, TFR] },  // 0,1  → x+  Right
        { verts: [TFL, TBL, BBL, BFL] },  // 2,3  → x-  Left
        { verts: [TFL, TFR, TBR, TBL] },  // 4,5  → y+  Top
        { verts: [BFL, BBL, BBR, BFR] },  // 6,7  → y-  Bottom
        { verts: [BFL, BFR, TFR, TFL] },  // 8,9  → z+  Front
        { verts: [TBL, TBR, BBR, BBL] },  // 10,11→ z-  Back
    ];

    // Flatten to Float32Array: 6 × 2 triangles × 3 verts × 3 coords
    const positions = new Float32Array(6 * 2 * 3 * 3);
    let i = 0;
    for (const { verts: [v0, v1, v2, v3] } of quads) {
        for (const v of [v0, v1, v2, v0, v2, v3]) {
            positions[i++] = v[0];
            positions[i++] = v[1];
            positions[i++] = v[2];
        }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.computeVertexNormals(); // non-indexed → sharp flat-shaded edges throughout

    // UV mapping: planar projection per face — order mirrors quads above
    const uvs = new Float32Array(6 * 2 * 3 * 2);
    let ui = 0;
    const uvFaces = [
        [[BFR, BBR, TBR, TFR], (v) => [(hd - v[2]) / d, (v[1] + hh) / h]],        // Right  (x+) flip Z
        [[TFL, TBL, BBL, BFL], (v) => [(v[2] + hd) / d, (v[1] + hh) / h]],        // Left   (x-)
        [[TFL, TFR, TBR, TBL], (v) => [(v[0] + hw) / w, (v[2] + hd) / d]],        // Top    (y+)
        [[BFL, BBL, BBR, BFR], (v) => [(v[0] + hw) / w, (hd - v[2]) / d]],        // Bottom (y-)
        [[BFL, BFR, TFR, TFL], (v) => [(v[0] + hw) / w, (v[1] + hh) / h]],        // Front  (z+)
        [[TBL, TBR, BBR, BBL], (v) => [(hw - v[0]) / w, (v[1] + hh) / h]],        // Back   (z-) flip X
    ];
    for (const [verts, uvFn] of uvFaces) {
        const [v0, v1, v2, v3] = verts;
        for (const v of [v0, v1, v2, v0, v2, v3]) {
            const [u, vv] = uvFn(v);
            uvs[ui++] = u;
            uvs[ui++] = vv;
        }
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

    return geo;
}

// ── Shared Constants for Dado mapping ────────────────────────────────────────
export const FACE_MAP = {
  top:    { depthAxis: 1, sign: +1, faceAxes: [0, 2] },
  bottom: { depthAxis: 1, sign: -1, faceAxes: [0, 2] },
  front:  { depthAxis: 2, sign: +1, faceAxes: [0, 1] },
  back:   { depthAxis: 2, sign: -1, faceAxes: [0, 1] },
  right:  { depthAxis: 0, sign: +1, faceAxes: [1, 2] },
  left:   { depthAxis: 0, sign: -1, faceAxes: [1, 2] },
};
export const AXIS_LABELS = ['x', 'y', 'z'];

export const buildArcTool = (size, op) => {
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

export const buildCoveTool = (size, op) => {
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

export const buildDadoTool = (size, op) => {
  const face = FACE_MAP[op.face || 'top'];
  const { depthAxis, sign, faceAxes } = face;

  const depth = Math.max(0.01, op.depth ?? 0.375);
  const width = Math.max(0.01, op.width ?? 0.75);
  const offset = op.offset ?? 0;
  const lengthOffset = op.lengthOffset ?? 0;

  const dirAxis = op.direction === AXIS_LABELS[faceAxes[1]] ? faceAxes[1] : faceAxes[0];
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

export const buildBlindHoleTool = (size, op) => {
  const face = FACE_MAP[op.face || 'top'];
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

export const buildMiterTool = (size, op) => {
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

export const buildEdgeProfileTool = (size, op) => {
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
