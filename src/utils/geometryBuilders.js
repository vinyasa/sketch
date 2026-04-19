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
