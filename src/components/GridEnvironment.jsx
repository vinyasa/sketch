import React from 'react';
import { Text } from '@react-three/drei';

export const ShadowFloor = ({ shadows }) => {
  if (!shadows) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[200, 200]} />
      <shadowMaterial transparent opacity={0.25} />
    </mesh>
  );
};

export const FloorFrontLabel = () => (
  <Text
    position={[0, 0.05, 23]}
    rotation={[-Math.PI / 2, 0, 0]}
    fontSize={3.2}
    maxWidth={15}
    textAlign="center"
    anchorX="center"
    anchorY="middle"
    color="rgba(188,138,95,0.55)"
    outlineColor="rgba(0,0,0,0.3)"
    outlineWidth={0.06}
    letterSpacing={0.08}
    depthOffset={-1}
    renderOrder={1}
  >
    FRONT
  </Text>
);

export const GridEnvironment = ({ showGrid, printCapture, theme, workspaceSize, gridSnap, lighting, units }) => {
  if (printCapture) return null;

  const isDark = theme === 'dark';
  const majorColor = isDark ? 0x666666 : 0x999999;
  const minorColor = isDark ? 0x242424 : 0xd2d2d2;

  const size = workspaceSize || 120;
  const gridRadius = size;
  let minorDivs = 0, majorDivs = Math.ceil(size / 6);

  if (units === 'metric') {
    const sizeMm = size * 25.4;
    if (gridSnap === '1 mm') {
      minorDivs = Math.round(sizeMm / 10);
      majorDivs = Math.round(sizeMm / 100) || 1;
    } else if (gridSnap === '2 mm') {
      minorDivs = Math.round(sizeMm / 20);
      majorDivs = Math.round(sizeMm / 100) || 1;
    } else if (gridSnap === '5 mm') {
      minorDivs = Math.round(sizeMm / 50);
      majorDivs = Math.round(sizeMm / 100) || 1;
    } else if (gridSnap === '10 mm') {
      minorDivs = Math.round(sizeMm / 100) || 1;
      majorDivs = Math.round(sizeMm / 200) || 1;
    } else if (gridSnap === 'off') {
      minorDivs = 0;
      majorDivs = Math.round(sizeMm / 100) || 1;
    } else {
      minorDivs = Math.round(sizeMm / 50);
      majorDivs = Math.round(sizeMm / 100) || 1;
    }
  } else {
    if (gridSnap === '1/16 in') {
      minorDivs = size * 4;
      majorDivs = Math.ceil(size / 1.5) || 1;
    } else if (gridSnap === '1/8 in') {
      minorDivs = size * 2;
      majorDivs = Math.ceil(size / 3) || 1;
    } else if (gridSnap === '1/4 in') {
      minorDivs = size;
      majorDivs = Math.ceil(size / 6) || 1;
    } else if (gridSnap === '1/2 in' || gridSnap === '1 in') {
      minorDivs = size;
      majorDivs = Math.ceil(size / 6) || 1;
    } else if (gridSnap === 'off') {
      minorDivs = 0;
      majorDivs = Math.ceil(size / 6) || 1;
    } else {
      minorDivs = size;
      majorDivs = Math.ceil(size / 6) || 1;
    }
  }

  return (
    <group>
      <ShadowFloor shadows={lighting?.shadows} />
      {showGrid && minorDivs > 0 && (
        <gridHelper key={`min_${minorDivs}_${theme}`} args={[gridRadius, minorDivs, minorColor, minorColor]} position={[0, -0.02, 0]} />
      )}
      {showGrid && <gridHelper key={`maj_${majorDivs}_${theme}`} args={[gridRadius, majorDivs, majorColor, majorColor]} position={[0, 0.02, 0]} />}
      {showGrid && (
        <axesHelper 
          args={[size / 2]} 
          position={[0, 0.03, 0]} 
          onUpdate={(self) => {
            const xColor = isDark ? '#ff5555' : '#aa0000';
            const yColor = isDark ? '#55ff55' : '#00aa00';
            const zColor = isDark ? '#5555ff' : '#0000aa';
            self.setColors(xColor, yColor, zColor);
          }}
        />
      )}
      {showGrid && <FloorFrontLabel />}
    </group>
  );
};
