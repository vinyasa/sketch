import React from 'react';
import * as THREE from 'three';
import { Line, Billboard, Text } from '@react-three/drei';
import useStore from '../store/useStore';
import { formatUnit } from '../utils/units';

export function MeasureSnapPreview({ boards, measureMode }) {
  const measureHoverSnap = useStore(s => s.measureHoverSnap);
  const measurementStyle = useStore(s => s.measurementStyle) || 'arrows';
  const units = useStore(s => s.units);
  const imperialFormat = useStore(s => s.imperialFormat);
  if (!measureMode?.active) return null;

  // Helper: localOffset → world position
  const toWorld = (localOffset, board) => {
    const euler = new THREE.Euler(...(board.orientation || [0, 0, 0]), 'YXZ');
    const pivot = board.pivot || [0, 0, 0];
    const pt = new THREE.Vector3(localOffset[0] - pivot[0], localOffset[1] - pivot[1], localOffset[2] - pivot[2]);
    pt.applyEuler(euler);
    return [pt.x + board.position[0], pt.y + board.position[1], pt.z + board.position[2]];
  };

  return (
    <group>
      {/* Hover snap marker — cyan indicator at nearest snap point */}
      {measureHoverSnap && (() => {
        const snapBoard = boards.find(b => b.id.toString() === measureHoverSnap.boardId);
        if (!snapBoard) return null;
        const wp = toWorld(measureHoverSnap.localOffset, snapBoard);
        const isCorner = measureHoverSnap.type === 'corner';
        const isEdge = measureHoverSnap.type === 'edge';
        return (
          <group>
            <mesh position={wp} renderOrder={11} raycast={() => null}>
              {isCorner ? <boxGeometry args={[0.25, 0.25, 0.25]} /> : <sphereGeometry args={[isEdge ? 0.2 : 0.15, 12, 12]} />}
              <meshBasicMaterial color={isCorner ? '#00ff88' : isEdge ? '#00ccff' : '#ffcc00'} depthTest={false} transparent opacity={0.85} />
            </mesh>
          </group>
        );
      })()}

      {/* First point marker — orange sphere */}
      {measureMode.firstPoint && (() => {
        const board = boards.find(b => b.id.toString() === measureMode.firstPoint.boardId);
        if (!board) return null;
        const worldPos = toWorld(measureMode.firstPoint.localOffset, board);
        return (
          <group>
            <mesh position={worldPos} renderOrder={10} raycast={() => null}>
              <sphereGeometry args={[0.25, 16, 16]} />
              <meshBasicMaterial color="#ff9f0a" depthTest={false} transparent opacity={0.9} />
            </mesh>
            <mesh position={worldPos} renderOrder={9} raycast={() => null}>
              <ringGeometry args={[0.35, 0.5, 24]} />
              <meshBasicMaterial color="#ff9f0a" depthTest={false} transparent opacity={0.4} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })()}

      {/* Drag preview — show dimension line with offset while dragging */}
      {measureMode.dragging && measureMode.firstPoint && measureMode.secondPoint && (() => {
        const boardA = boards.find(b => b.id.toString() === measureMode.firstPoint.boardId);
        const boardB = boards.find(b => b.id.toString() === measureMode.secondPoint.boardId);
        if (!boardA || !boardB) return null;
        const wA = toWorld(measureMode.firstPoint.localOffset, boardA);
        const wB = toWorld(measureMode.secondPoint.localOffset, boardB);
        const off = measureMode.dragOffset || 0;
        const dir = measureMode.offsetDir || [0, 1, 0];
        const oA = [wA[0] + dir[0]*off, wA[1] + dir[1]*off, wA[2] + dir[2]*off];
        const oB = [wB[0] + dir[0]*off, wB[1] + dir[1]*off, wB[2] + dir[2]*off];
        const mid = [(oA[0]+oB[0])/2, (oA[1]+oB[1])/2, (oA[2]+oB[2])/2];
        const dist = Math.sqrt((wA[0]-wB[0])**2 + (wA[1]-wB[1])**2 + (wA[2]-wB[2])**2);
        return (
          <group>
            {/* Leader lines */}
            <Line points={[wA, oA]} color="#ff9f0a" lineWidth={1} depthTest={false} renderOrder={4} />
            <Line points={[wB, oB]} color="#ff9f0a" lineWidth={1} depthTest={false} renderOrder={4} />
            {/* Dimension line */}
            <Line points={[oA, oB]} color="#ff9f0a" lineWidth={2.5} depthTest={false} renderOrder={4} />
            {/* End treatment based on style */}
            {(() => {
              const tickDir = new THREE.Vector3(...dir).normalize();
              const lineDir = new THREE.Vector3(oB[0]-oA[0], oB[1]-oA[1], oB[2]-oA[2]);
              const lineLen = lineDir.length();
              if (lineLen < 0.05) return null;
              lineDir.normalize();

              if (measurementStyle === 'arrows') {
                const coneHeight = 0.45;
                const coneRadius = 0.12;
                const cA = [oA[0] + lineDir.x * (coneHeight / 2), oA[1] + lineDir.y * (coneHeight / 2), oA[2] + lineDir.z * (coneHeight / 2)];
                const qA = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), lineDir.clone().negate());
                const cB = [oB[0] - lineDir.x * (coneHeight / 2), oB[1] - lineDir.y * (coneHeight / 2), oB[2] - lineDir.z * (coneHeight / 2)];
                const qB = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), lineDir);

                return (
                  <>
                    <mesh position={cA} quaternion={qA} renderOrder={5} raycast={() => null}>
                      <coneGeometry args={[coneRadius, coneHeight, 8]} />
                      <meshBasicMaterial color="#ff9f0a" depthTest={false} />
                    </mesh>
                    <mesh position={cB} quaternion={qB} renderOrder={5} raycast={() => null}>
                      <coneGeometry args={[coneRadius, coneHeight, 8]} />
                      <meshBasicMaterial color="#ff9f0a" depthTest={false} />
                    </mesh>
                  </>
                );
              } else if (measurementStyle === 'slashes') {
                const slashLen = 0.35;
                const slashVec = new THREE.Vector3().addVectors(lineDir, tickDir).normalize().multiplyScalar(slashLen);
                return (
                  <>
                    <Line points={[
                      [oA[0]-slashVec.x, oA[1]-slashVec.y, oA[2]-slashVec.z],
                      [oA[0]+slashVec.x, oA[1]+slashVec.y, oA[2]+slashVec.z]
                    ]} color="#ff9f0a" lineWidth={2.5} depthTest={false} renderOrder={4} />
                    <Line points={[
                      [oB[0]-slashVec.x, oB[1]-slashVec.y, oB[2]-slashVec.z],
                      [oB[0]+slashVec.x, oB[1]+slashVec.y, oB[2]+slashVec.z]
                    ]} color="#ff9f0a" lineWidth={2.5} depthTest={false} renderOrder={4} />
                  </>
                );
              } else {
                // Classic spheres with perpendicular ticks
                const tickLen = 0.4;
                return (
                  <>
                    <Line points={[
                      [oA[0]-tickDir.x*tickLen, oA[1]-tickDir.y*tickLen, oA[2]-tickDir.z*tickLen],
                      [oA[0]+tickDir.x*tickLen, oA[1]+tickDir.y*tickLen, oA[2]+tickDir.z*tickLen]
                    ]} color="#ff9f0a" lineWidth={1.5} depthTest={false} renderOrder={4} />
                    <Line points={[
                      [oB[0]-tickDir.x*tickLen, oB[1]-tickDir.y*tickLen, oB[2]-tickDir.z*tickLen],
                      [oB[0]+tickDir.x*tickLen, oB[1]+tickDir.y*tickLen, oB[2]+tickDir.z*tickLen]
                    ]} color="#ff9f0a" lineWidth={1.5} depthTest={false} renderOrder={4} />
                    <mesh position={oA} renderOrder={5} raycast={() => null}>
                      <sphereGeometry args={[0.2, 8, 8]} />
                      <meshBasicMaterial color="#ff9f0a" depthTest={false} />
                    </mesh>
                    <mesh position={oB} renderOrder={5} raycast={() => null}>
                      <sphereGeometry args={[0.2, 8, 8]} />
                      <meshBasicMaterial color="#ff9f0a" depthTest={false} />
                    </mesh>
                  </>
                );
              }
            })()}
            <Billboard position={mid}>
              <Text fontSize={0.9} color="#ff9f0a" anchorX="center" anchorY="bottom" renderOrder={5} material-depthTest={false} outlineWidth={0.04} outlineColor="#000000">
                {formatUnit(dist, units, imperialFormat)}
              </Text>
            </Billboard>
          </group>
        );
      })()}
    </group>
  );
}
