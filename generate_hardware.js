/**
 * Generate starter hardware GLTF models using raw JSON.
 * Run with: node generate_hardware.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = path.join(__dirname, 'public', 'models');
if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true });

// ── Helper: create a minimal valid glTF 2.0 with embedded geometry ───────────
function boxNode(name, sx, sy, sz, tx, ty, tz, color, rx, ry, rz) {
    // Returns a simple description; we'll build actual glTF below
    return { name, size: [sx, sy, sz], pos: [tx, ty, tz], color, rot: [rx||0, ry||0, rz||0] };
}

function cylNode(name, r, h, tx, ty, tz, color, rx, ry, rz) {
    return { name, type: 'cyl', radius: r, height: h, pos: [tx, ty, tz], color, rot: [rx||0, ry||0, rz||0] };
}

function sphNode(name, r, tx, ty, tz, color) {
    return { name, type: 'sph', radius: r, pos: [tx, ty, tz], color };
}

// Generate a box geometry as raw vertex data (non-indexed, 36 vertices)
function makeBoxVertices(sx, sy, sz) {
    const hx = sx/2, hy = sy/2, hz = sz/2;
    // 6 faces, 2 triangles each, 3 vertices each = 36 vertices
    const faces = [
        // +X
        [[hx,-hy,-hz],[hx,hy,-hz],[hx,hy,hz],[hx,-hy,-hz],[hx,hy,hz],[hx,-hy,hz]],
        // -X
        [[-hx,-hy,hz],[-hx,hy,hz],[-hx,hy,-hz],[-hx,-hy,hz],[-hx,hy,-hz],[-hx,-hy,-hz]],
        // +Y
        [[-hx,hy,-hz],[hx,hy,-hz],[hx,hy,hz],[-hx,hy,-hz],[hx,hy,hz],[-hx,hy,hz]],
        // -Y  
        [[-hx,-hy,hz],[hx,-hy,hz],[hx,-hy,-hz],[-hx,-hy,hz],[hx,-hy,-hz],[-hx,-hy,-hz]],
        // +Z
        [[-hx,-hy,hz],[hx,-hy,hz],[hx,hy,hz],[-hx,-hy,hz],[hx,hy,hz],[-hx,hy,hz]],
        // -Z
        [[hx,-hy,-hz],[-hx,-hy,-hz],[-hx,hy,-hz],[hx,-hy,-hz],[-hx,hy,-hz],[hx,hy,-hz]],
    ];
    const normals = [
        [1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]
    ];
    const positions = [];
    const norms = [];
    for (let f = 0; f < 6; f++) {
        for (const v of faces[f]) {
            positions.push(...v);
            norms.push(...normals[f]);
        }
    }
    return { positions: new Float32Array(positions), normals: new Float32Array(norms) };
}

// Generate cylinder vertices (approximate)
function makeCylVertices(radius, height, segments = 16) {
    const positions = [];
    const normals = [];
    const hy = height / 2;
    for (let i = 0; i < segments; i++) {
        const a1 = (i / segments) * Math.PI * 2;
        const a2 = ((i + 1) / segments) * Math.PI * 2;
        const c1 = Math.cos(a1), s1 = Math.sin(a1);
        const c2 = Math.cos(a2), s2 = Math.sin(a2);
        // Side quad (2 triangles)
        positions.push(c1*radius, -hy, s1*radius, c2*radius, -hy, s2*radius, c2*radius, hy, s2*radius);
        normals.push(c1,0,s1, c2,0,s2, c2,0,s2);
        positions.push(c1*radius, -hy, s1*radius, c2*radius, hy, s2*radius, c1*radius, hy, s1*radius);
        normals.push(c1,0,s1, c2,0,s2, c1,0,s1);
        // Top cap
        positions.push(0, hy, 0, c1*radius, hy, s1*radius, c2*radius, hy, s2*radius);
        normals.push(0,1,0, 0,1,0, 0,1,0);
        // Bottom cap
        positions.push(0, -hy, 0, c2*radius, -hy, s2*radius, c1*radius, -hy, s1*radius);
        normals.push(0,-1,0, 0,-1,0, 0,-1,0);
    }
    return { positions: new Float32Array(positions), normals: new Float32Array(normals) };
}

// Generate sphere vertices (approximate UV sphere)
function makeSphVertices(radius, wSeg = 12, hSeg = 8) {
    const positions = [];
    const normals = [];
    for (let y = 0; y < hSeg; y++) {
        const phi1 = (y / hSeg) * Math.PI;
        const phi2 = ((y + 1) / hSeg) * Math.PI;
        for (let x = 0; x < wSeg; x++) {
            const th1 = (x / wSeg) * Math.PI * 2;
            const th2 = ((x + 1) / wSeg) * Math.PI * 2;
            const p = (phi, th) => {
                const sp = Math.sin(phi), cp = Math.cos(phi);
                const st = Math.sin(th), ct = Math.cos(th);
                return [sp*ct*radius, cp*radius, sp*st*radius];
            };
            const n = (phi, th) => {
                const sp = Math.sin(phi), cp = Math.cos(phi);
                const st = Math.sin(th), ct = Math.cos(th);
                return [sp*ct, cp, sp*st];
            };
            const v00 = p(phi1,th1), v10 = p(phi1,th2), v01 = p(phi2,th1), v11 = p(phi2,th2);
            const n00 = n(phi1,th1), n10 = n(phi1,th2), n01 = n(phi2,th1), n11 = n(phi2,th2);
            positions.push(...v00,...v01,...v10);
            normals.push(...n00,...n01,...n10);
            positions.push(...v10,...v01,...v11);
            normals.push(...n10,...n01,...n11);
        }
    }
    return { positions: new Float32Array(positions), normals: new Float32Array(normals) };
}

// Build a complete glTF 2.0 JSON from a list of primitive descriptions
function buildGltf(parts) {
    const bufferDatas = [];
    const accessors = [];
    const bufferViews = [];
    const meshes = [];
    const nodes = [];
    const materials = [];
    const materialMap = {};
    let byteOffset = 0;

    for (const part of parts) {
        // Material
        const colorKey = JSON.stringify(part.color);
        if (!(colorKey in materialMap)) {
            materialMap[colorKey] = materials.length;
            materials.push({
                pbrMetallicRoughness: {
                    baseColorFactor: [...part.color, 1.0],
                    metallicFactor: 0.7,
                    roughnessFactor: 0.35,
                },
            });
        }

        let geo;
        if (part.type === 'cyl') {
            geo = makeCylVertices(part.radius, part.height);
        } else if (part.type === 'sph') {
            geo = makeSphVertices(part.radius);
        } else {
            geo = makeBoxVertices(...part.size);
        }

        // Positions
        const posBuf = Buffer.from(geo.positions.buffer);
        const posViewIdx = bufferViews.length;
        bufferViews.push({ buffer: 0, byteOffset, byteLength: posBuf.length });
        bufferDatas.push(posBuf);
        
        // Compute bounds
        let minP = [Infinity,Infinity,Infinity], maxP = [-Infinity,-Infinity,-Infinity];
        for (let i = 0; i < geo.positions.length; i += 3) {
            for (let j = 0; j < 3; j++) {
                minP[j] = Math.min(minP[j], geo.positions[i+j]);
                maxP[j] = Math.max(maxP[j], geo.positions[i+j]);
            }
        }
        
        const posAccIdx = accessors.length;
        accessors.push({
            bufferView: posViewIdx,
            componentType: 5126, // FLOAT
            count: geo.positions.length / 3,
            type: 'VEC3',
            min: minP, max: maxP,
        });
        byteOffset += posBuf.length;

        // Normals
        const normBuf = Buffer.from(geo.normals.buffer);
        const normViewIdx = bufferViews.length;
        bufferViews.push({ buffer: 0, byteOffset, byteLength: normBuf.length });
        bufferDatas.push(normBuf);
        const normAccIdx = accessors.length;
        accessors.push({
            bufferView: normViewIdx,
            componentType: 5126,
            count: geo.normals.length / 3,
            type: 'VEC3',
        });
        byteOffset += normBuf.length;

        // Mesh
        const meshIdx = meshes.length;
        meshes.push({
            primitives: [{
                attributes: { POSITION: posAccIdx, NORMAL: normAccIdx },
                material: materialMap[colorKey],
            }],
        });

        // Node
        const node = { name: part.name, mesh: meshIdx, translation: part.pos };
        if (part.rot && (part.rot[0] || part.rot[1] || part.rot[2])) {
            // Convert Euler to quaternion (simple single-axis rotations)
            const [rx, ry, rz] = part.rot;
            const cx = Math.cos(rx/2), sx = Math.sin(rx/2);
            const cy = Math.cos(ry/2), sy = Math.sin(ry/2);
            const cz = Math.cos(rz/2), sz = Math.sin(rz/2);
            node.rotation = [
                sx*cy*cz - cx*sy*sz,
                cx*sy*cz + sx*cy*sz,
                cx*cy*sz - sx*sy*cz,
                cx*cy*cz + sx*sy*sz,
            ];
        }
        nodes.push(node);
    }

    const allBuf = Buffer.concat(bufferDatas);
    const b64 = allBuf.toString('base64');

    return {
        asset: { version: '2.0', generator: 'LittleLucey-HardwareGen' },
        scene: 0,
        scenes: [{ nodes: nodes.map((_, i) => i) }],
        nodes,
        meshes,
        accessors,
        bufferViews,
        materials,
        buffers: [{ uri: `data:application/octet-stream;base64,${b64}`, byteLength: allBuf.length }],
    };
}

function saveGltf(parts, filename) {
    const gltf = buildGltf(parts);
    const json = JSON.stringify(gltf);
    const outPath = path.join(MODELS_DIR, filename);
    fs.writeFileSync(outPath, json);
    console.log(`  ✓ ${filename} (${(json.length / 1024).toFixed(1)} KB)`);
}

// ── Model definitions ────────────────────────────────────────────────────────
const SILVER = [0.69, 0.69, 0.69];
const BRASS = [0.79, 0.66, 0.30];
const BLACK = [0.2, 0.2, 0.2];

console.log('Generating hardware models...');

// Euro Hinge
saveGltf([
    { ...cylNode('Cup', 0.69, 0.45, 0, 0, -0.22, SILVER, Math.PI/2, 0, 0) },
    { ...boxNode('Arm', 0.5, 0.15, 1.8, 0, 0, 0.7, SILVER) },
    { ...boxNode('Plate', 0.5, 0.08, 2.0, 0, -0.12, 0.8, SILVER) },
], 'euro-hinge.gltf');

// Butt Hinge
saveGltf([
    { ...boxNode('LeftLeaf', 1.5, 3.0, 0.08, -0.75, 0, 0, BRASS) },
    { ...boxNode('RightLeaf', 1.5, 3.0, 0.08, 0.75, 0, 0, BRASS) },
    { ...cylNode('Pin', 0.1, 3.0, 0, 0, 0, BRASS) },
], 'butt-hinge.gltf');

// Bar Pull
saveGltf([
    { ...cylNode('Bar', 0.15, 5.0, 0, 0.6, 0, SILVER, 0, 0, Math.PI/2) },
    { ...cylNode('PostL', 0.12, 0.6, -2.0, 0.3, 0, SILVER) },
    { ...cylNode('PostR', 0.12, 0.6, 2.0, 0.3, 0, SILVER) },
    { ...cylNode('BaseL', 0.25, 0.06, -2.0, 0, 0, SILVER) },
    { ...cylNode('BaseR', 0.25, 0.06, 2.0, 0, 0, SILVER) },
], 'bar-pull.gltf');

// Round Knob
saveGltf([
    { ...sphNode('Knob', 0.5, 0, 0.7, 0, BRASS) },
    { ...cylNode('Post', 0.12, 0.5, 0, 0.25, 0, BRASS) },
    { ...cylNode('Base', 0.35, 0.08, 0, 0, 0, BRASS) },
], 'round-knob.gltf');

// Drawer Slide
saveGltf([
    { ...boxNode('OuterRail', 18, 0.5, 0.08, 0, 0.25, 0, BLACK) },
    { ...boxNode('InnerRail', 14, 0.4, 0.06, 2, 0.25, 0.07, SILVER) },
    { ...boxNode('Flange', 18, 0.06, 0.5, 0, 0.03, 0.21, BLACK) },
], 'drawer-slide.gltf');

console.log('Done! Models saved to public/models/');
