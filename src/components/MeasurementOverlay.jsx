import React from 'react';
import * as THREE from 'three';
import { Line, Billboard, Text, Html } from '@react-three/drei';
import useStore from '../store/useStore';
import { formatUnit } from '../utils/units';

export function MeasurementOverlay({ boards, selectedItemIds, showMeasurements, measurements, units, theme }) {
  const printCapture = useStore(s => s.printCapture);
  const isPrinting = !!printCapture;

  // During print: hide auto-dims always; show custom measurements only if showDims is checked
  if (!showMeasurements && !isPrinting) return null;

  const lineColor = theme === 'dark' ? '#999999' : '#777777';
  const textColor = theme === 'dark' ? '#cccccc' : '#333333';
  const textSize = 0.9;

  // ── Helper: convert local offset to world position for a board ──
  const localToWorld = (localOffset, board) => {
    if (!board) return localOffset;
    const euler = new THREE.Euler(...(board.orientation || [0, 0, 0]), 'YXZ');
    const pivot = board.pivot || [0, 0, 0];
    const pt = new THREE.Vector3(
      localOffset[0] - pivot[0],
      localOffset[1] - pivot[1],
      localOffset[2] - pivot[2]
    );
    pt.applyEuler(euler);
    return [
      pt.x + board.position[0],
      pt.y + board.position[1],
      pt.z + board.position[2],
    ];
  };

  return (
    <group userData={{ printProtected: true }}>
      {/* ── Ephemeral auto-dims for selected boards (never printed) ── */}
      {!isPrinting && selectedItemIds.map(id => {
        const b = boards.find(x => x.id.toString() === id);
        if (!b) return null;

        const hx = b.size[0] / 2, hy = b.size[1] / 2, hz = b.size[2] / 2;
        const oY = 1.5;
        const oX = 1.5;

        // X dimension line — across the top (Local space)
        const xD = [[-hx, hy + oY, 0], [hx, hy + oY, 0]];
        const xT1 = [[-hx, hy + oY - 0.3, 0], [-hx, hy + oY + 0.3, 0]];
        const xT2 = [[hx, hy + oY - 0.3, 0], [hx, hy + oY + 0.3, 0]];

        // Y dimension line — along the right side (Local space)
        const yD = [[hx + oX, -hy, 0], [hx + oX, hy, 0]];
        const yT1 = [[hx + oX - 0.3, -hy, 0], [hx + oX + 0.3, -hy, 0]];
        const yT2 = [[hx + oX - 0.3, hy, 0], [hx + oX + 0.3, hy, 0]];

        // Z dimension line — along the bottom (Local space)
        const zD = [[0, -hy - oY, -hz], [0, -hy - oY, hz]];
        const zT1 = [[0, -hy - oY - 0.3, -hz], [0, -hy - oY + 0.3, -hz]];
        const zT2 = [[0, -hy - oY - 0.3, hz], [0, -hy - oY + 0.3, hz]];

        const ptX = [0, hy + oY + 0.5, 0];
        const ptY = [hx + oX + 0.6, 0, 0];
        const ptZ = [0, -hy - oY - 0.5, 0];

        return (
          <group key={`dim_${id}`} position={b.position} rotation={b.orientation ? [...b.orientation, 'YXZ'] : [0, 0, 0, 'YXZ']}>
             <Line points={xD} color={lineColor} lineWidth={1.5} depthTest={false} renderOrder={2} />
             <Line points={xT1} color={lineColor} lineWidth={1.5} depthTest={false} renderOrder={2} />
             <Line points={xT2} color={lineColor} lineWidth={1.5} depthTest={false} renderOrder={2} />
             <Billboard position={ptX}>
                <Text fontSize={textSize} color={textColor} anchorX="center" anchorY="bottom" renderOrder={3} material-depthTest={false} outlineWidth={0.03} outlineColor={theme === 'dark' ? '#000000' : '#ffffff'}>
                  {formatUnit(b.size[0], units)}
                </Text>
             </Billboard>

             <Line points={yD} color={lineColor} lineWidth={1.5} depthTest={false} renderOrder={2} />
             <Line points={yT1} color={lineColor} lineWidth={1.5} depthTest={false} renderOrder={2} />
             <Line points={yT2} color={lineColor} lineWidth={1.5} depthTest={false} renderOrder={2} />
             <Billboard position={ptY}>
                <Text fontSize={textSize} color={textColor} anchorX="left" anchorY="middle" renderOrder={3} material-depthTest={false} outlineWidth={0.03} outlineColor={theme === 'dark' ? '#000000' : '#ffffff'}>
                  {formatUnit(b.size[1], units)}
                </Text>
             </Billboard>

             <Line points={zD} color={lineColor} lineWidth={1.5} depthTest={false} renderOrder={2} />
             <Line points={zT1} color={lineColor} lineWidth={1.5} depthTest={false} renderOrder={2} />
             <Line points={zT2} color={lineColor} lineWidth={1.5} depthTest={false} renderOrder={2} />
             <Billboard position={ptZ}>
                <Text fontSize={textSize} color={textColor} anchorX="center" anchorY="top" renderOrder={3} material-depthTest={false} outlineWidth={0.03} outlineColor={theme === 'dark' ? '#000000' : '#ffffff'}>
                  {formatUnit(b.size[2], units)}
                </Text>
             </Billboard>
          </group>
        );
      })}

      {/* ── Persistent custom measurements (shown during print if showDims) ── */}
      {(!isPrinting || printCapture?.showDims) && (measurements || []).map(m => {
        const boardA = boards.find(b => b.id.toString() === m.pointA.boardId);
        const boardB = boards.find(b => b.id.toString() === m.pointB.boardId);
        if (!boardA || !boardB) return null;

        const wA = localToWorld(m.pointA.localOffset, boardA);
        const wB = localToWorld(m.pointB.localOffset, boardB);
        const dist = Math.sqrt((wA[0]-wB[0])**2 + (wA[1]-wB[1])**2 + (wA[2]-wB[2])**2);

        const { selectedMeasurementId, setSelectedMeasurementId, removeMeasurement } = useStore.getState();
        const isActive = selectedMeasurementId === m.id;
        const color = isActive ? '#ffcc00' : (m.color || '#ff9f0a');

        // Compute offset positions (for leader-line style dimensions)
        const off = m.offset || 0;
        const dir = m.offsetDir || [0, 1, 0];
        const oA = [wA[0]+dir[0]*off, wA[1]+dir[1]*off, wA[2]+dir[2]*off];
        const oB = [wB[0]+dir[0]*off, wB[1]+dir[1]*off, wB[2]+dir[2]*off];
        const mid = [(oA[0]+oB[0])/2, (oA[1]+oB[1])/2, (oA[2]+oB[2])/2];

        return (
          <group key={m.id}>
            {/* Leader lines (extension/witness lines) from actual points to offset */}
            {Math.abs(off) > 0.1 && (
              <>
                <Line points={[wA, oA]} color={color} lineWidth={1} depthTest={false} renderOrder={4} />
                <Line points={[wB, oB]} color={color} lineWidth={1} depthTest={false} renderOrder={4} />
              </>
            )}
            {/* Main dimension line (at offset position) */}
            <Line points={[oA, oB]} color={color} lineWidth={isActive ? 3.5 : 2.5} depthTest={false} renderOrder={4} />
            {/* End ticks perpendicular to the line */}
            {(() => {
              const tickDir = new THREE.Vector3(...dir);
              const tickLen = 0.4;
              return (
                <>
                  <Line points={[
                    [oA[0]-tickDir.x*tickLen, oA[1]-tickDir.y*tickLen, oA[2]-tickDir.z*tickLen],
                    [oA[0]+tickDir.x*tickLen, oA[1]+tickDir.y*tickLen, oA[2]+tickDir.z*tickLen]
                  ]} color={color} lineWidth={1.5} depthTest={false} renderOrder={4} />
                  <Line points={[
                    [oB[0]-tickDir.x*tickLen, oB[1]-tickDir.y*tickLen, oB[2]-tickDir.z*tickLen],
                    [oB[0]+tickDir.x*tickLen, oB[1]+tickDir.y*tickLen, oB[2]+tickDir.z*tickLen]
                  ]} color={color} lineWidth={1.5} depthTest={false} renderOrder={4} />
                </>
              );
            })()}
            {/* Endpoint spheres */}
            <mesh position={oA} renderOrder={5} raycast={() => null}>
              <sphereGeometry args={[0.2, 8, 8]} />
              <meshBasicMaterial color={color} depthTest={false} />
            </mesh>
            <mesh position={oB} renderOrder={5} raycast={() => null}>
              <sphereGeometry args={[0.2, 8, 8]} />
              <meshBasicMaterial color={color} depthTest={false} />
            </mesh>
            {/* Label at offset midpoint */}
            <Billboard position={mid}>
              <Text fontSize={textSize * 1.1} color={color} anchorX="center" anchorY="bottom" renderOrder={5} material-depthTest={false} outlineWidth={0.04} outlineColor="#000000">
                {formatUnit(dist, units)}
              </Text>
            </Billboard>
            {/* Invisible click target along the offset line */}
            {(() => {
              const lineDir = new THREE.Vector3(oB[0]-oA[0], oB[1]-oA[1], oB[2]-oA[2]);
              const len = lineDir.length();
              if (len < 0.5) return (
                <mesh position={mid}
                  onClick={(e) => { e.stopPropagation(); setSelectedMeasurementId(isActive ? null : m.id); }}
                  onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
                  onPointerOut={() => { document.body.style.cursor = 'auto'; }}
                >
                  <sphereGeometry args={[1.0, 8, 8]} />
                  <meshBasicMaterial visible={false} />
                </mesh>
              );
              lineDir.normalize();
              const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), lineDir);
              return (
                <mesh position={mid} quaternion={quat}
                  onClick={(e) => { e.stopPropagation(); setSelectedMeasurementId(isActive ? null : m.id); }}
                  onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
                  onPointerOut={() => { document.body.style.cursor = 'auto'; }}
                >
                  <cylinderGeometry args={[0.5, 0.5, len, 6]} />
                  <meshBasicMaterial visible={false} />
                </mesh>
              );
            })()}
            {/* Delete button when selected */}
            {isActive && (
              <Html position={[mid[0], mid[1] + 1.5, mid[2]]} center style={{ pointerEvents: 'auto' }}>
                <button onClick={() => removeMeasurement(m.id)} style={{
                  background: 'rgba(255,59,48,0.85)', color: '#fff', border: 'none', borderRadius: '50%',
                  width: '22px', height: '22px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                }} title="Delete measurement">✕</button>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
