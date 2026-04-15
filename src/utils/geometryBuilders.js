import * as THREE from 'three';

// ── Corner helpers ──────────────────────────────────────────────────────────
// Outer corner keys: 'fl' | 'fr' | 'bl' | 'br'
// (f=front/Z+, b=back/Z-, l=left/X-, r=right/X+)
//
// angleZ = taper angle (°) for the Z-perpendicular inner face
//   FL/FR outer → back  (Z-) face tilts inward
//   BL/BR outer → front (Z+) face tilts inward
//
// angleX = taper angle (°) for the X-perpendicular inner face
//   FL/BL outer → right (X+) face tilts inward
//   FR/BR outer → left  (X-) face tilts inward
//
// Setting angleZ=0 or angleX=0 gives a single-face taper on the other axis.

/**
 * Normalise legacy { 'z-': a, 'x+': b } taper format to the corner model.
 * New format { outerCorner, angleZ, angleX } passes through unchanged.
 * @param {object} taper
 * @returns {{ outerCorner: string, angleZ: number, angleX: number }}
 */
export function normalizeTaper(taper = {}) {
    if (taper.outerCorner) {
        return {
            outerCorner: taper.outerCorner ?? 'fl',
            angleZ: taper.angleZ ?? 0,
            angleX: taper.angleX ?? 0,
        };
    }
    // Legacy: { 'z-': a, 'x+': b } implied outer corner = front-left
    return {
        outerCorner: 'fl',
        angleZ: taper['z-'] ?? 0,
        angleX: taper['x+'] ?? 0,
    };
}

/**
 * Validate taper angles against actual board dimensions.
 * Returns the remaining (bottom) width and depth plus warning strings.
 *
 * @param {number} w   board size[0] (bounding box width)
 * @param {number} h   board size[1] (bounding box height)
 * @param {number} d   board size[2] (bounding box depth)
 * @param {number} az  Z-axis inner face taper angle in °
 * @param {number} ax  X-axis inner face taper angle in °
 * @returns {{ zBottom, xBottom, zWarn, xWarn }}
 */
export function taperValidation(w, h, d, az, ax) {
    const tapZ = h * Math.tan((az * Math.PI) / 180);
    const tapX = h * Math.tan((ax * Math.PI) / 180);
    const zBottom = +(d - tapZ).toFixed(4);
    const xBottom = +(w - tapX).toFixed(4);
    return {
        zBottom,
        xBottom,
        zWarn: zBottom <= 0 ? `Z taper too steep — bottom depth would be ${zBottom}"` : null,
        xWarn: xBottom <= 0 ? `X taper too steep — bottom width would be ${xBottom}"` : null,
    };
}

/**
 * Compute the four bottom corner positions for a given outer-corner configuration.
 * Returns named corners { BFL, BFR, BBL, BBR } in local board space
 * (board is centred at origin: X ±w/2, Y ±h/2, Z ±d/2).
 *
 * @param {number} hw  half-width  (w/2)
 * @param {number} hh  half-height (h/2)
 * @param {number} hd  half-depth  (d/2)
 * @param {string} outerCorner  'fl' | 'fr' | 'bl' | 'br'
 * @param {number} tapZ  displacement magnitude along Z (h*tan(angleZ))
 * @param {number} tapX  displacement magnitude along X (h*tan(angleX))
 */
function computeBottomCorners(hw, hh, hd, outerCorner, tapZ, tapX) {
    switch (outerCorner) {
        case 'fl': return {
            BFL: [-hw,          -hh,  +hd         ],  // outer  — FIXED
            BFR: [+hw - tapX,   -hh,  +hd         ],  // right walks left
            BBL: [-hw,          -hh,  -hd + tapZ  ],  // back  walks forward
            BBR: [+hw - tapX,   -hh,  -hd + tapZ  ],  // inner corner
        };
        case 'fr': return {
            BFR: [+hw,          -hh,  +hd         ],  // outer  — FIXED
            BFL: [-hw + tapX,   -hh,  +hd         ],  // left  walks right
            BBR: [+hw,          -hh,  -hd + tapZ  ],  // back  walks forward
            BBL: [-hw + tapX,   -hh,  -hd + tapZ  ],  // inner corner
        };
        case 'bl': return {
            BBL: [-hw,          -hh,  -hd         ],  // outer  — FIXED
            BBR: [+hw - tapX,   -hh,  -hd         ],  // right walks left
            BFL: [-hw,          -hh,  +hd - tapZ  ],  // front walks back
            BFR: [+hw - tapX,   -hh,  +hd - tapZ  ],  // inner corner
        };
        case 'br': return {
            BBR: [+hw,          -hh,  -hd         ],  // outer  — FIXED
            BBL: [-hw + tapX,   -hh,  -hd         ],  // left  walks right
            BFR: [+hw,          -hh,  +hd - tapZ  ],  // front walks back
            BFL: [-hw + tapX,   -hh,  +hd - tapZ  ],  // inner corner
        };
        default: return computeBottomCorners(hw, hh, hd, 'fl', tapZ, tapX);
    }
}

/**
 * Build a tapered-box BufferGeometry from an outer-corner specification.
 *
 * The outer corner is the bottom corner that does NOT move — it sits on the
 * floor exactly where the apron / structural member meets it.  The two
 * adjacent bottom corners tilt inward by angleZ° (Z-perpendicular face) and
 * angleX° (X-perpendicular face).  Setting either angle to 0 gives a
 * single-face taper.
 *
 * The bounding box (w × h × d) is always intact — no corner exceeds it —
 * so all Flush/Glue constraints work unchanged on the AABB.
 *
 * Uses 24 vertices (4 per face) for sharp flat-shaded edges.
 *
 * @param {number} w            Full width  (X) — bounding box
 * @param {number} h            Full height (Y) — bounding box
 * @param {number} d            Full depth  (Z) — bounding box
 * @param {string} outerCorner  'fl'|'fr'|'bl'|'br'  default 'fl'
 * @param {number} angleZDeg    Inner Z-face taper angle in °  (0 = straight)
 * @param {number} angleXDeg    Inner X-face taper angle in °  (0 = straight)
 * @returns {THREE.BufferGeometry}
 */
export function buildTaperGeometry(w, h, d, outerCorner = 'fl', angleZDeg = 0, angleXDeg = 0) {
    const tapZ = h * Math.tan((angleZDeg * Math.PI) / 180);
    const tapX = h * Math.tan((angleXDeg * Math.PI) / 180);
    const hw = w / 2, hh = h / 2, hd = d / 2;

    // Top corners — full-size rectangle, always the same regardless of outer corner
    const TFL = [-hw,  +hh,  +hd];
    const TFR = [+hw,  +hh,  +hd];
    const TBL = [-hw,  +hh,  -hd];
    const TBR = [+hw,  +hh,  -hd];

    // Bottom corners — determined by outer corner config
    const { BFL, BFR, BBL, BBR } = computeBottomCorners(hw, hh, hd, outerCorner, tapZ, tapX);

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
