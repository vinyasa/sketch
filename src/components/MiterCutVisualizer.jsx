import React from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import useStore from '../store/useStore';
import { getTopFrontIntersection, getDynamicAngles } from '../utils/miterSawCalculator';
import { formatUnit } from '../utils/units';

export function MiterCutVisualizer() {
  const {
    boards,
    miterSawCuts,
    miterSawBoardId,
    selectedMiterCutIndex,
    units,
    imperialFormat,
  } = useStore();

  if (
    !miterSawCuts ||
    !miterSawBoardId ||
    selectedMiterCutIndex === null ||
    selectedMiterCutIndex === undefined
  ) {
    return null;
  }

  const board = boards.find((b) => b.id.toString() === miterSawBoardId);
  if (!board) return null;

  const cut = miterSawCuts[selectedMiterCutIndex];
  if (!cut) return null;

  // Calculate miter/bevel saw angles dynamically based on orientation
  const { miter, bevel } = getDynamicAngles(board, cut);

  // 1. Calculate world position of the Top-Front edge intersection point
  const { localX, worldPos } = getTopFrontIntersection(board, cut);
  const [rx, ry, rz] = board.orientation || [0, 0, 0];
  const euler = new THREE.Euler(rx, ry, rz, 'YXZ');

  // Compute dynamic label based on intersection point and active format
  let displayLabel = cut.label;
  if (!['Left End', 'Right End'].includes(cut.label)) {
    const distFromLeft = localX + board.size[0] / 2;
    if (units === 'metric') {
      displayLabel = `Cut at ${(distFromLeft * 25.4).toFixed(0)} mm`;
    } else {
      displayLabel = `Cut at ${formatUnit(distFromLeft, 'imperial', imperialFormat)}`;
    }
  }

  // 2. Calculate world normal of the cut
  const localNormal = new THREE.Vector3(...cut.normal);
  const worldNormal = localNormal.clone().applyEuler(euler).normalize();

  // 3. Create quaternion to align plane geometry (+Z) with world normal
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    worldNormal
  );

  // Plane size slightly larger than the board width (size[2]) and thickness (size[1]) (multiplied by 4.4 for twice the size)
  const planeWidth = board.size[2] * 4.4;
  const planeHeight = board.size[1] * 4.4;

  // If miter or bevel angle is > 60, use warning red, otherwise bright blue glow
  const hasLargeAngle = Math.abs(miter) > 60 || Math.abs(bevel) > 60;
  const color = hasLargeAngle ? '#ff3b30' : '#00c7fc';

  return (
    <group position={worldPos.toArray()} quaternion={quaternion}>
      {/* Semi-transparent cut plane */}
      <mesh raycast={() => null}>
        <planeGeometry args={[planeWidth, planeHeight]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.45}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Plane outline */}
      <lineSegments raycast={() => null}>
        <edgesGeometry args={[new THREE.PlaneGeometry(planeWidth, planeHeight)]} />
        <lineBasicMaterial color={color} linewidth={2} transparent opacity={0.8} />
      </lineSegments>

      {/* Red dot at the cut centroid */}
      <mesh raycast={() => null} renderOrder={10}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color="#ff3b30" depthTest={false} />
      </mesh>

      {/* HTML tooltip label */}
      <Html position={[0, planeHeight / 2 + 0.5, 0]} center style={{ pointerEvents: 'none' }}>
        <div
          style={{
            background: hasLargeAngle ? 'rgba(255, 59, 48, 0.95)' : 'rgba(30, 30, 30, 0.9)',
            border: `1px solid ${color}`,
            color: 'white',
            padding: '5px 10px',
            borderRadius: '6px',
            fontSize: '0.72rem',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            whiteSpace: 'nowrap',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            alignItems: 'center',
          }}
        >
          <div style={{ color: 'var(--accent-color)', opacity: 0.9 }}>{displayLabel}</div>
          <div style={{ fontSize: '0.78rem' }}>
            Miter: <span style={{ color: Math.abs(miter) > 60 ? '#ff453a' : '#00ffff' }}>{miter}°</span> |{' '}
            Bevel: <span style={{ color: Math.abs(bevel) > 60 ? '#ff453a' : '#00ffff' }}>{bevel}°</span>
          </div>
          {hasLargeAngle && (
            <div style={{ fontSize: '0.58rem', color: '#ffcc00', marginTop: '2px' }}>
              ⚠️ Exceeds 60° Saw Limit
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}
