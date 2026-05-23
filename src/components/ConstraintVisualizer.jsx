import React from 'react';
import * as THREE from 'three';
import { Line, Html } from '@react-three/drei';

export function ConstraintVisualizer({ boards, groups, selectedItemIds, constraints }) {
  if (!constraints || Object.keys(constraints).length === 0) return null;
  const selSet = new Set(selectedItemIds);

  // Only show constraints where at least one board is selected
  const visibleConstraints = Object.entries(constraints).filter(([_, c]) =>
    selSet.has(c.boardAId) || selSet.has(c.boardBId)
  );
  if (visibleConstraints.length === 0) return null;

  const getFaceWorldPos3 = (bd, faceStr) => {
    if (!bd) return new THREE.Vector3(0, 0, 0);
    if (!faceStr) return new THREE.Vector3(...bd.position);
    const pos = new THREE.Vector3(...bd.position);
    const axisChar = faceStr[0];
    const sign = faceStr[1] === '+' ? 1 : -1;
    if (axisChar === 'x') pos.x += (bd.size[0] / 2) * sign;
    else if (axisChar === 'y') pos.y += (bd.size[1] / 2) * sign;
    else pos.z += (bd.size[2] / 2) * sign;
    return pos;
  };

  return (
    <group>
      {visibleConstraints.map(([cId, c]) => {
        const bA = boards.find(b => b.id.toString() === c.boardAId);
        const bB = boards.find(b => b.id.toString() === c.boardBId);
        if (!bA || !bB) return null;

        const startPos = c.type === 'Flush'
          ? getFaceWorldPos3(bA, c.faceA)
          : new THREE.Vector3(...bA.position);
        const endPos = c.type === 'Flush'
          ? getFaceWorldPos3(bB, c.faceB)
          : new THREE.Vector3(...bB.position);

        const midPos = startPos.clone().lerp(endPos, 0.5);
        const color = c.enabled === false ? '#888888' : c.type === 'Glue' ? '#ff9f0a' : '#00ffff';

        return (
          <group key={cId}>
            <Line
              points={[startPos, endPos]}
              color={color}
              lineWidth={3}
              dashed={c.enabled === false}
              dashScale={10} dashSize={1} dashOffset={0}
            />
            <Html position={midPos.toArray()} center style={{ pointerEvents: 'none' }}>
              <div style={{
                background: c.enabled === false ? 'rgba(136,136,136,0.8)' : color,
                color: 'white', padding: '2px 6px', borderRadius: '12px',
                fontSize: '0.75rem', fontWeight: 'bold',
                boxShadow: '0 2px 4px rgba(0,0,0,0.5)', whiteSpace: 'nowrap',
                opacity: c.enabled === false ? 0.7 : 1
              }}>
                {c.enabled === false ? '🔓' : '🔒'} {c.type}{c.type === 'Flush' ? ` ${['X','Y','Z'][c.axis]}` : ''}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}
