/**
 * assemblyThumbnail.js
 *
 * Renders a quick isometric-ish thumbnail of an assembly's boards using an
 * offscreen Three.js scene (no React / R3F needed at all).
 *
 * Returns a data-URL PNG string (≈5-15 KB at 128×128).
 */

import * as THREE from 'three';
import { getMaterialDisplayColor } from './materialCatalogue';

const SIZE = 128; // thumbnail pixel dimensions
const BG_COLOR_DARK = 0x1a1a1a;

/**
 * @param {Array} boards  — array of board objects { size:[x,y,z], position:[x,y,z], material }
 * @returns {Promise<string>}  data-URL PNG
 */
export async function renderAssemblyThumbnail(boards) {
    if (!boards || boards.length === 0) {
        return _placeholderDataUrl();
    }

    // ── Scene setup ─────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
    });
    renderer.setSize(SIZE, SIZE);
    renderer.setPixelRatio(1);
    renderer.setClearColor(BG_COLOR_DARK, 1);

    const scene = new THREE.Scene();

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(20, 30, 20);
    scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0xaaddff, 0.4);
    fillLight.position.set(-10, 5, -10);
    scene.add(fillLight);

    // ── Board meshes ─────────────────────────────────────────────────────────
    const geo = new THREE.BoxGeometry(1, 1, 1);

    boards.forEach((b, i) => {
        if (b.visible === false) return;
        // Use catalogue color so thumbnail matches viewport material
        const hex = getMaterialDisplayColor(b.material);
        const mat = new THREE.MeshStandardMaterial({
            color: hex,
            roughness: 0.8,
            metalness: 0.0,
        });
        const mesh = new THREE.Mesh(geo.clone(), mat);
        mesh.scale.set(b.size[0], b.size[1], b.size[2]);
        mesh.position.set(b.position[0], b.position[1], b.position[2]);
        if (b.orientation) mesh.rotation.set(b.orientation[0], b.orientation[1], b.orientation[2], 'YXZ');
        scene.add(mesh);

        // Add edge lines for clarity
        const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(b.size[0], b.size[1], b.size[2]));
        const lineMat = new THREE.LineBasicMaterial({ color: 0x333333 });
        const line = new THREE.LineSegments(edges, lineMat);
        line.position.set(b.position[0], b.position[1], b.position[2]);
        if (b.orientation) line.rotation.set(b.orientation[0], b.orientation[1], b.orientation[2], 'YXZ');
        scene.add(line);
    });

    // ── Camera: fit assembly in view ─────────────────────────────────────────
    // 1. Bounding-sphere radius = half the AABB diagonal (worst-case extent).
    // 2. Required camera distance = radius / tan(halfFov), + 20% padding.
    //    This works for any shape: flat, tall, cubic, or anything in between.
    // Orientation-aware AABB for camera framing
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    boards.forEach(b => {
        if (b.visible === false) return;
        const [px, py, pz] = b.position;
        const hx = b.size[0] / 2, hy = b.size[1] / 2, hz = b.size[2] / 2;
        const [rx, ry, rz] = b.orientation || [0, 0, 0];
        if (rx === 0 && ry === 0 && rz === 0) {
            minX = Math.min(minX, px - hx); maxX = Math.max(maxX, px + hx);
            minY = Math.min(minY, py - hy); maxY = Math.max(maxY, py + hy);
            minZ = Math.min(minZ, pz - hz); maxZ = Math.max(maxZ, pz + hz);
        } else {
            const a = Math.cos(rx), b = Math.sin(rx);
            const c = Math.cos(ry), d = Math.sin(ry);
            const e = Math.cos(rz), f = Math.sin(rz);
            const ce = c*e, cf = c*f, de = d*e, df = d*f;
            const R00 = ce+df*b,  R01 = de*b-cf,  R02 = a*d;
            const R10 = a*f,      R11 = a*e,      R12 = -b;
            const R20 = cf*b-de,  R21 = df+ce*b,  R22 = a*c;
            for (let ix = -1; ix <= 1; ix += 2)
                for (let iy = -1; iy <= 1; iy += 2)
                    for (let iz = -1; iz <= 1; iz += 2) {
                        const lx = hx*ix, ly = hy*iy, lz = hz*iz;
                        const wx = px + R00*lx + R01*ly + R02*lz;
                        const wy = py + R10*lx + R11*ly + R12*lz;
                        const wz = pz + R20*lx + R21*ly + R22*lz;
                        minX = Math.min(minX, wx); maxX = Math.max(maxX, wx);
                        minY = Math.min(minY, wy); maxY = Math.max(maxY, wy);
                        minZ = Math.min(minZ, wz); maxZ = Math.max(maxZ, wz);
                    }
        }
    });

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;

    const dx = maxX - minX, dy = maxY - minY, dz = maxZ - minZ;
    const sphereRadius = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz) / 2, 1);

    const fovDeg = 40;
    const halfFovRad = (fovDeg / 2) * (Math.PI / 180);
    const dist = (sphereRadius / Math.tan(halfFovRad)) * 1.20; // 20% breathing room

    const camera = new THREE.PerspectiveCamera(fovDeg, 1, 0.01, 10000);
    // Same isometric-ish angle as the main viewport (right + slightly above + front)
    const dir = new THREE.Vector3(0.6, 0.55, 0.8).normalize();
    camera.position.set(cx + dir.x * dist, cy + dir.y * dist, cz + dir.z * dist);
    camera.lookAt(cx, cy, cz);

    // ── Render ───────────────────────────────────────────────────────────────
    renderer.render(scene, camera);

    const dataUrl = renderer.domElement.toDataURL('image/png');

    // Cleanup
    renderer.dispose();
    geo.dispose();
    scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
            else obj.material.dispose();
        }
    });

    return dataUrl;
}

/** Fallback grey square when there are no boards */
function _placeholderDataUrl() {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = '#444';
    ctx.font = '32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('📦', SIZE / 2, SIZE / 2);
    return canvas.toDataURL('image/png');
}
