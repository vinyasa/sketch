import { useRef, useMemo } from 'react';
import { useGizmoContext } from '@react-three/drei';
import * as THREE from 'three';

// ─── Axis definitions ─────────────────────────────────────────────────────────
// Each face: direction (unit vector), label, axis color, is it a positive face?
const FACES = [
    { dir: new THREE.Vector3(1,  0,  0), label: 'R', color: '#ff3b30', positive: true  },
    { dir: new THREE.Vector3(-1, 0,  0), label: 'L', color: '#ff3b30', positive: false },
    { dir: new THREE.Vector3(0,  1,  0), label: 'U', color: '#34c759', positive: true  },
    { dir: new THREE.Vector3(0, -1,  0), label: 'D', color: '#34c759', positive: false },
    { dir: new THREE.Vector3(0,  0,  1), label: 'F', color: '#007aff', positive: true  },
    { dir: new THREE.Vector3(0,  0, -1), label: 'B', color: '#007aff', positive: false },
];

// ─── Pair lines (only draw one line per axis pair, from -tip to +tip) ─────────
const AXIS_PAIRS = [
    { a: new THREE.Vector3(-1, 0, 0), b: new THREE.Vector3(1, 0, 0), color: '#ff3b30' },
    { a: new THREE.Vector3(0, -1, 0), b: new THREE.Vector3(0, 1, 0), color: '#34c759' },
    { a: new THREE.Vector3(0, 0, -1), b: new THREE.Vector3(0, 0,  1), color: '#007aff' },
];

// ─── Build a canvas-based label texture (avoids troika-three-text dep) ────────
function makeLabelTexture(label, color) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Ball fill
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Letter
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${size * 0.44}px Inter, Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, size / 2, size / 2 + 2);

    return new THREE.CanvasTexture(canvas);
}

// ─── Axis line using BufferGeometry ───────────────────────────────────────────
function AxisLine({ from, to, color }) {
    const geo = useMemo(() => {
        const g = new THREE.BufferGeometry();
        g.setFromPoints([from, to]);
        return g;
    }, [from, to]);

    return (
        <line geometry={geo}>
            <lineBasicMaterial color={color} linewidth={2} />
        </line>
    );
}

// ─── Single face ball with label sprite ───────────────────────────────────────
function FaceBall({ face }) {
    const { tweenCamera } = useGizmoContext();
    const { dir, label, color, positive } = face;

    const texture = useMemo(() => makeLabelTexture(label, color), [label, color]);
    const pos = dir.clone().multiplyScalar(1.0);

    const handleClick = (e) => {
        e.stopPropagation();
        tweenCamera(dir);
    };

    return (
        <sprite
            position={pos}
            scale={[positive ? 0.55 : 0.45, positive ? 0.55 : 0.45, 1]}
            onClick={handleClick}
            onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
            onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = 'auto'; }}
            renderOrder={2}
        >
            <spriteMaterial
                map={texture}
                transparent
                opacity={positive ? 1.0 : 0.65}
                depthTest={false}
            />
        </sprite>
    );
}

// ─── Main custom gizmo ────────────────────────────────────────────────────────
export function CustomGizmoViewport() {
    return (
        // Scale matches drei's GizmoViewport default scene scale
        <group scale={40}>
            {/* Axis lines */}
            {AXIS_PAIRS.map(({ a, b, color }) => (
                <AxisLine
                    key={color}
                    from={a.clone().multiplyScalar(0.8)}
                    to={b.clone().multiplyScalar(0.8)}
                    color={color}
                />
            ))}

            {/* Face balls with R/L, U/D, F/B labels */}
            {FACES.map((face) => (
                <FaceBall key={face.label} face={face} />
            ))}
        </group>
    );
}
