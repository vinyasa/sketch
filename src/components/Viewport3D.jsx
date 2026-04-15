import React, { useState, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera, OrthographicCamera, OrbitControls, useTexture, GizmoHelper, Text, Edges, Line, Html } from '@react-three/drei';
import { CustomGizmoViewport } from './CustomGizmoViewport';
import * as THREE from 'three';
import useStore from '../store/useStore';
import { computeWorldAABB, collectChildBoards, calculateGroupAABB } from '../utils/sceneGraph';
import { formatUnit } from '../utils/units';
import { WOOD_CATALOGUE, WOOD_TEXTURE_URLS, normalizeMaterial } from '../utils/materialCatalogue';
import { buildTaperGeometry, normalizeTaper } from '../utils/geometryBuilders';


// ─── SceneLights: renders all lights from the lighting store slice ────────────
const SceneLights = ({ lighting }) => {
  if (!lighting?.lights) return null;
  return (
    <group>
      {lighting.lights.filter(l => l.enabled).map(l => {
        switch (l.type) {
          case 'ambient':
            return <ambientLight key={l.id} color={l.color} intensity={l.intensity} />;

          case 'hemisphere':
            return <hemisphereLight key={l.id} args={[l.color, l.groundColor ?? '#333333', l.intensity]} />;

          case 'directional': {
            const target = new THREE.Object3D();
            target.position.set(...(l.target ?? [0, 0, 0]));
            return (
              <group key={l.id}>
                <directionalLight
                  color={l.color}
                  intensity={l.intensity}
                  position={l.position ?? [10, 20, 10]}
                  castShadow={lighting.shadows && l.castShadow}
                  shadow-mapSize-width={l.shadowMapSize ?? 1024}
                  shadow-mapSize-height={l.shadowMapSize ?? 1024}
                  shadow-camera-near={0.5}
                  shadow-camera-far={200}
                  shadow-camera-left={-40}
                  shadow-camera-right={40}
                  shadow-camera-top={40}
                  shadow-camera-bottom={-40}
                  shadow-bias={-0.0004}
                  target-position={l.target ?? [0, 0, 0]}
                />
              </group>
            );
          }

          case 'point':
            return (
              <pointLight
                key={l.id}
                color={l.color}
                intensity={l.intensity}
                position={l.position ?? [0, 20, 0]}
                distance={l.distance ?? 0}
                decay={l.decay ?? 2}
              />
            );

          case 'spot': {
            return (
              <spotLight
                key={l.id}
                color={l.color}
                intensity={l.intensity}
                position={l.position ?? [10, 30, 10]}
                angle={l.angle ?? 0.4}
                penumbra={l.penumbra ?? 0.3}
                decay={l.decay ?? 1.5}
                castShadow={lighting.shadows && l.castShadow}
                shadow-mapSize-width={l.shadowMapSize ?? 1024}
                shadow-mapSize-height={l.shadowMapSize ?? 1024}
                shadow-bias={-0.0004}
                target-position={l.target ?? [0, 0, 0]}
              />
            );
          }

          case 'rectarea':
            return (
              <rectAreaLight
                key={l.id}
                color={l.color}
                intensity={l.intensity}
                position={l.position ?? [0, 20, 0]}
                width={l.width ?? 10}
                height={l.height ?? 10}
                rotation={[-Math.PI / 2, 0, 0]}
              />
            );

          default:
            return null;
        }
      })}
    </group>
  );
};

// ─── Invisible floor plane that only receives shadows ────────────────────────
const ShadowFloor = ({ shadows }) => {
  if (!shadows) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[200, 200]} />
      <shadowMaterial transparent opacity={0.25} />
    </mesh>
  );
};

// ─── FRONT label on the floor ────────────────────────────────────────────────
// Lies flat on the Y=0 plane, centered on the +Z (Front) axis.
// fontSize is tuned so the word spans ≈15 scene-units (inches) wide.
const FloorFrontLabel = () => (
  <Text
    position={[0, 0.05, 23]}       // sit just above Y=0, 23" in front
    rotation={[-Math.PI / 2, 0, 0]} // lay flat, readable when looking down
    fontSize={3.2}                  // ~3.2" tall glyphs → ≈15" total word width
    maxWidth={15}
    textAlign="center"
    anchorX="center"
    anchorY="middle"
    color="rgba(188,138,95,0.55)"   // warm amber, unobtrusive
    outlineColor="rgba(0,0,0,0.3)"
    outlineWidth={0.06}
    letterSpacing={0.08}
    depthOffset={-1}                 // render on top of the grid plane
    renderOrder={1}
  >
    FRONT
  </Text>
);

const ConstraintVisualizer = ({ boards, groups, selectedItemIds, constraints }) => {
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
};

const DimensioningOverlay = ({ boards, selectedItemIds, showDimensions, units, theme }) => {
  if (!showDimensions || selectedItemIds.length === 0) return null;
  const isDark = theme === 'dark';

  return (
    <group>
      {selectedItemIds.map(id => {
        const b = boards.find(x => x.id.toString() === id);
        if (!b) return null;
        
        const px = b.position[0], py = b.position[1], pz = b.position[2];
        const hx = b.size[0] / 2, hy = b.size[1] / 2, hz = b.size[2] / 2;
        
        const color = isDark ? '#888888' : '#666666';
        const oY = 1.5;
        const oX = 1.5;

        // X dimension line (Red) — across the top front
        const xD = [[px - hx, py + hy + oY, pz], [px + hx, py + hy + oY, pz]];
        const xT1 = [[px - hx, py + hy + oY - 0.25, pz], [px - hx, py + hy + oY + 0.25, pz]];
        const xT2 = [[px + hx, py + hy + oY - 0.25, pz], [px + hx, py + hy + oY + 0.25, pz]];

        // Y dimension line (Green/Up) — along the right side
        const yD = [[px + hx + oX, py - hy, pz], [px + hx + oX, py + hy, pz]];
        const yT1 = [[px + hx + oX - 0.25, py - hy, pz], [px + hx + oX + 0.25, py - hy, pz]];
        const yT2 = [[px + hx + oX - 0.25, py + hy, pz], [px + hx + oX + 0.25, py + hy, pz]];

        // Z dimension line (Blue/Depth) — along the bottom
        const zD = [[px, py - hy - oY, pz - hz], [px, py - hy - oY, pz + hz]];
        const zT1 = [[px, py - hy - oY - 0.25, pz - hz], [px, py - hy - oY + 0.25, pz - hz]];
        const zT2 = [[px, py - hy - oY - 0.25, pz + hz], [px, py - hy - oY + 0.25, pz + hz]];

        const ptX = [px, py + hy + oY + 0.2, pz];
        const ptY = [px + hx + oX + 0.4, py, pz];
        const ptZ = [px, py - hy - oY - 0.2, pz];

        // Dimension labels: sort to show Length/Width/Thickness
        const sorted = [...b.size].sort((a, c) => c - a);

        return (
          <group key={`dim_${id}`}>
             <Line points={xD} color={color} lineWidth={1.5} />
             <Line points={xT1} color={color} lineWidth={1.5} />
             <Line points={xT2} color={color} lineWidth={1.5} />
             <Html position={ptX} center style={{ pointerEvents: 'none', transition: 'all 0.1s' }}>
                <div style={{ color: isDark ? '#d0d0d0' : '#222222', fontSize: '0.75rem', fontWeight: 'bold' }}>X: {formatUnit(b.size[0], units)}</div>
             </Html>

             <Line points={yD} color={color} lineWidth={1.5} />
             <Line points={yT1} color={color} lineWidth={1.5} />
             <Line points={yT2} color={color} lineWidth={1.5} />
             <Html position={ptY} center style={{ pointerEvents: 'none', transition: 'all 0.1s' }}>
                <div style={{ color: isDark ? '#d0d0d0' : '#222222', fontSize: '0.75rem', fontWeight: 'bold' }}>Y: {formatUnit(b.size[1], units)}</div>
             </Html>

             <Line points={zD} color={color} lineWidth={1.5} />
             <Line points={zT1} color={color} lineWidth={1.5} />
             <Line points={zT2} color={color} lineWidth={1.5} />
             <Html position={ptZ} center style={{ pointerEvents: 'none', transition: 'all 0.1s' }}>
                <div style={{ color: isDark ? '#d0d0d0' : '#222222', fontSize: '0.75rem', fontWeight: 'bold' }}>Z: {formatUnit(b.size[2], units)}</div>
             </Html>
          </group>
        );
      })}
    </group>
  );
};

const BoundingBoxVisualizer = ({ boards, groups, selectedItemIds, showBoundingBox, theme }) => {
  if (!showBoundingBox || selectedItemIds.length === 0) return null;
  
  const validBoards = [];

  const traverse = (pId) => {
    boards.filter(b => b.parentId === pId).forEach(b => validBoards.push(b));
    Object.keys(groups).filter(k => groups[k].parentId === pId).forEach(k => traverse(k));
  };

  selectedItemIds.forEach(id => {
    if (Object.keys(groups).includes(id)) {
        traverse(id);
    } else {
        const b = boards.find(x => x.id.toString() === id);
        if (b) validBoards.push(b);
    }
  });

  if (validBoards.length === 0) return null;

  const aabb = computeWorldAABB(validBoards);

  const width = Math.abs(aabb.maxX - aabb.minX);
  const height = Math.abs(aabb.maxY - aabb.minY);
  const depth = Math.abs(aabb.maxZ - aabb.minZ);
  const centerX = aabb.minX + width / 2;
  const centerY = aabb.minY + height / 2;
  const centerZ = aabb.minZ + depth / 2;

  const isDark = theme === 'dark';
  return (
    <mesh position={[centerX, centerY, centerZ]}>
      <boxGeometry args={[width, height, depth]} />
      <meshBasicMaterial color={isDark ? '#00ffff' : '#007aff'} wireframe={true} transparent opacity={0.6} depthTest={false} />
    </mesh>
  );
};

// ─── Memoized custom geometry for tapered boards ─────────────────────────────
// Rebuilds only when size or taper angles change. Returns a primitive so
// React Three Fiber can manage the bufferGeometry lifecycle cleanly.
const TaperGeometry = ({ b }) => {
  const { outerCorner, angleZ, angleX } = normalizeTaper(b.taper);
  const [w, h, d] = b.size;
  const geo = useMemo(
    () => buildTaperGeometry(w, h, d, outerCorner, angleZ, angleX),
    [w, h, d, outerCorner, angleZ, angleX]
  );
  return <primitive object={geo} attach="geometry" />;
};

const BoardMesh = ({ b, selectedItemIds, toggleSelection, textures, showEdges, constraintTargetMode, hoveredFaceData, setHoveredFaceData, modifierActive }) => {
  if (b.visible === false) return null;
  const isSelected = selectedItemIds.includes(b.id.toString());

  // Face labels are fixed in world space — no rotation means these are always correct
  const faceLabels = {
    'x+': 'right', 'x-': 'left',
    'y+': 'top',   'y-': 'bottom',
    'z+': 'front', 'z-': 'back'
  };

  return (
    <mesh
      raycast={(modifierActive && constraintTargetMode?.active) ? () => null : undefined}
      position={b.position}
      rotation={b.rotation || [0, 0, 0]}
      castShadow
      receiveShadow
      onClick={(e) => {
        e.stopPropagation(); // stop from bubbling to Canvas onPointerMissed only
        const faceStr = e.faceIndex !== undefined ? ['x+', 'x-', 'y+', 'y-', 'z+', 'z-'][Math.floor(e.faceIndex / 2)] : null;
        toggleSelection(b.id.toString(), e.shiftKey || e.ctrlKey || e.metaKey, faceStr);
      }}
      onPointerMove={(e) => {
        const isActiveMode = constraintTargetMode && constraintTargetMode.active;
        if (isSelected || isActiveMode) {
          e.stopPropagation();
          if (e.faceIndex !== undefined) {
            const fStr = ['x+', 'x-', 'y+', 'y-', 'z+', 'z-'][Math.floor(e.faceIndex / 2)];
            if (!hoveredFaceData || hoveredFaceData.id !== b.id.toString() || hoveredFaceData.faceStr !== fStr) {
              setHoveredFaceData({ id: b.id.toString(), faceStr: fStr });
            }
          }
        }
      }}
      onPointerOut={(e) => {
        if (hoveredFaceData && hoveredFaceData.id === b.id.toString()) {
          setHoveredFaceData(null);
        }
      }}
    >
      {b.shape === 'taper'
        ? <TaperGeometry b={b} />
        : <boxGeometry args={b.size} />}
      {(() => {
        const matDesc = normalizeMaterial(b.material);
        // Key forces React to remount the material when type changes,
        // preventing stale color/map bleed-over between paint and wood.
        const matKey = matDesc.type === 'color' ? `color-${matDesc.hex}` : `wood-${matDesc.id}`;
        const commonProps = {
          emissive: isSelected ? '#bc8a5f' : '#000000',
          emissiveIntensity: isSelected ? 0.4 : 0,
        };
        if (matDesc.type === 'color') {
          return (
            <meshStandardMaterial
              key={matKey}
              color={matDesc.hex}
              roughness={0.85}
              {...commonProps}
            />
          );
        }
        const spec = WOOD_CATALOGUE[matDesc.id] ?? WOOD_CATALOGUE['pine'];
        return (
          <meshStandardMaterial
            key={matKey}
            color="#ffffff"  // explicitly reset — Three.js multiplies map by color; stale tints = wrong result
            map={textures[matDesc.id] ?? textures['pine']}
            roughness={spec.roughness}
            {...commonProps}
          />
        );
      })()}
      {showEdges && <Edges scale={1} threshold={15} color={isSelected ? '#ffffff' : '#222222'} />}
      {((isSelected || (constraintTargetMode && constraintTargetMode.active)) && hoveredFaceData && hoveredFaceData.id === b.id.toString()) && (() => {
        const faceStr = hoveredFaceData.faceStr;
        let pos = [0, 0, 0], rot = [0, 0, 0];
        const w = b.size[0] / 2 + 0.01;
        const h = b.size[1] / 2 + 0.01;
        const d = b.size[2] / 2 + 0.01;
        if (faceStr === 'x+') { pos = [w, 0, 0]; rot = [0, Math.PI / 2, 0]; }
        if (faceStr === 'x-') { pos = [-w, 0, 0]; rot = [0, -Math.PI / 2, 0]; }
        if (faceStr === 'y+') { pos = [0, h, 0]; rot = [-Math.PI / 2, 0, 0]; }
        if (faceStr === 'y-') { pos = [0, -h, 0]; rot = [Math.PI / 2, 0, 0]; }
        if (faceStr === 'z+') { pos = [0, 0, d]; rot = [0, 0, 0]; }
        if (faceStr === 'z-') { pos = [0, 0, -d]; rot = [0, Math.PI, 0]; }
        
        let planeW = faceStr.startsWith('x') ? b.size[2] : b.size[0];
        let planeH = faceStr.startsWith('y') ? b.size[2] : b.size[1];
        if (faceStr.startsWith('x')) planeH = b.size[1];
        if (faceStr.startsWith('z')) planeH = b.size[1];

        const tooltipLabel = faceLabels[faceStr] || faceStr;

        return (
          <group>
            <mesh position={pos} rotation={rot} raycast={() => null}>
              <planeGeometry args={[planeW, planeH]} />
              <meshBasicMaterial color="#00ffff" transparent opacity={0.4} depthTest={false} side={THREE.DoubleSide} />
            </mesh>
            <Html position={pos} center style={{ pointerEvents: 'none', zIndex: 10 }}>
              <div style={{
                background: 'rgba(0, 0, 0, 0.75)',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
              }}>
                {tooltipLabel}
              </div>
            </Html>
          </group>
        );
      })()}
    </mesh>
  );
};

const RecursiveNode = ({ nodeId, groups, boards, selectedItemIds, toggleSelection, textures, showEdges, constraintTargetMode, hoveredFaceData, setHoveredFaceData, modifierActive }) => {
  const isGroup = groups[nodeId] !== undefined;

  if (!isGroup) {
    const b = boards.find(x => x.id.toString() === nodeId);
    if (!b) return null;
    return (
      <BoardMesh
        b={b}
        selectedItemIds={selectedItemIds}
        toggleSelection={toggleSelection}
        textures={textures}
        showEdges={showEdges}
        constraintTargetMode={constraintTargetMode}
        hoveredFaceData={hoveredFaceData}
        setHoveredFaceData={setHoveredFaceData}
        modifierActive={modifierActive}
      />
    );
  }

  const g = groups[nodeId];
  if (g.visible === false) return null;

  const childGroups = Object.keys(groups).filter(k => groups[k].parentId === nodeId);
  const childBoards = boards.filter(b => b.parentId === nodeId);

  // Group proxy bounding box for constraint targeting
  let groupProxyBounds = null;
  if (constraintTargetMode?.active) {
    groupProxyBounds = calculateGroupAABB(nodeId, boards, groups);
  }

  return (
    <group>
      {groupProxyBounds && (
        <mesh
          position={[groupProxyBounds.centerX, groupProxyBounds.centerY, groupProxyBounds.centerZ]}
          raycast={!modifierActive ? () => null : undefined}
          onClick={(e) => {
            if (!modifierActive) return;
            e.stopPropagation();
            const faceStr = e.faceIndex !== undefined ? ['x+', 'x-', 'y+', 'y-', 'z+', 'z-'][Math.floor(e.faceIndex / 2)] : null;
            toggleSelection(nodeId, e.shiftKey || e.ctrlKey || e.metaKey, faceStr);
          }}
          onPointerMove={(e) => {
            if (!modifierActive) return;
            e.stopPropagation();
            if (e.faceIndex !== undefined) {
              const fStr = ['x+', 'x-', 'y+', 'y-', 'z+', 'z-'][Math.floor(e.faceIndex / 2)];
              if (!hoveredFaceData || hoveredFaceData.id !== nodeId || hoveredFaceData.faceStr !== fStr) {
                setHoveredFaceData({ id: nodeId, faceStr: fStr });
              }
            }
          }}
          onPointerOut={(e) => {
            if (hoveredFaceData && hoveredFaceData.id === nodeId) {
              setHoveredFaceData(null);
            }
          }}
        >
          <boxGeometry args={[groupProxyBounds.width + 0.05, groupProxyBounds.height + 0.05, groupProxyBounds.depth + 0.05]} />
          <meshBasicMaterial color="#bc8a5f" transparent opacity={modifierActive ? 0.3 : 0} depthTest={false} wireframe={true} />
          
          {(modifierActive && hoveredFaceData && hoveredFaceData.id === nodeId) && (() => {
             const faceStr = hoveredFaceData.faceStr;
             let pos = [0, 0, 0], rot = [0, 0, 0];
             const w = groupProxyBounds.width / 2 + 0.05;
             const h = groupProxyBounds.height / 2 + 0.05;
             const d = groupProxyBounds.depth / 2 + 0.05;
             if (faceStr === 'x+') { pos = [w, 0, 0]; rot = [0, Math.PI / 2, 0]; }
             if (faceStr === 'x-') { pos = [-w, 0, 0]; rot = [0, -Math.PI / 2, 0]; }
             if (faceStr === 'y+') { pos = [0, h, 0]; rot = [-Math.PI / 2, 0, 0]; }
             if (faceStr === 'y-') { pos = [0, -h, 0]; rot = [Math.PI / 2, 0, 0]; }
             if (faceStr === 'z+') { pos = [0, 0, d]; rot = [0, 0, 0]; }
             if (faceStr === 'z-') { pos = [0, 0, -d]; rot = [0, Math.PI, 0]; }
             
             let planeW = faceStr.startsWith('x') ? groupProxyBounds.depth : groupProxyBounds.width;
             let planeH = faceStr.startsWith('y') ? groupProxyBounds.depth : groupProxyBounds.height;
             if (faceStr.startsWith('x')) planeH = groupProxyBounds.height;
             if (faceStr.startsWith('z')) planeH = groupProxyBounds.height;
             return (
               <mesh position={pos} rotation={rot} raycast={() => null}>
                 <planeGeometry args={[planeW, planeH]} />
                 <meshBasicMaterial color="#bc8a5f" transparent opacity={0.6} depthTest={false} side={THREE.DoubleSide} />
               </mesh>
             );
          })()}
        </mesh>
      )}

      {childGroups.map(k => (
        <RecursiveNode key={k} nodeId={k} groups={groups} boards={boards} selectedItemIds={selectedItemIds} toggleSelection={toggleSelection} textures={textures} showEdges={showEdges} constraintTargetMode={constraintTargetMode} hoveredFaceData={hoveredFaceData} setHoveredFaceData={setHoveredFaceData} modifierActive={modifierActive} />
      ))}
      {childBoards.map(b => (
        <RecursiveNode key={`b_${b.id}`} nodeId={b.id.toString()} groups={groups} boards={boards} selectedItemIds={selectedItemIds} toggleSelection={toggleSelection} textures={textures} showEdges={showEdges} constraintTargetMode={constraintTargetMode} hoveredFaceData={hoveredFaceData} setHoveredFaceData={setHoveredFaceData} modifierActive={modifierActive} />
      ))}
    </group>
  );
};

function WoodJoint({ boards, groups, selectedItemIds, toggleSelection, showEdges, showDimensions, showBoundingBox, units, theme, constraintTargetMode, hoveredFaceData, setHoveredFaceData, modifierActive, constraints }) {
  // WOOD_TEXTURE_URLS is a stable module-level object — safe to pass to useTexture()
  const textures = useTexture(WOOD_TEXTURE_URLS);

  Object.values(textures).forEach(t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  });

  const rootGroups = Object.keys(groups).filter(k => groups[k].parentId === null);
  const rootBoards = boards.filter(b => b.parentId === 'Workspace');

  return (
    <group>
      {rootGroups.map(k => (
        <RecursiveNode key={k} nodeId={k} groups={groups} boards={boards} selectedItemIds={selectedItemIds} toggleSelection={toggleSelection} textures={textures} showEdges={showEdges} constraintTargetMode={constraintTargetMode} hoveredFaceData={hoveredFaceData} setHoveredFaceData={setHoveredFaceData} modifierActive={modifierActive} />
      ))}
      {rootBoards.map(b => (
        <BoardMesh key={`root_${b.id}`} b={b} selectedItemIds={selectedItemIds} toggleSelection={toggleSelection} textures={textures} showEdges={showEdges} constraintTargetMode={constraintTargetMode} hoveredFaceData={hoveredFaceData} setHoveredFaceData={setHoveredFaceData} modifierActive={modifierActive} />
      ))}
      <ConstraintVisualizer boards={boards} groups={groups} selectedItemIds={selectedItemIds} constraints={constraints} />
      <BoundingBoxVisualizer boards={boards} groups={groups} selectedItemIds={selectedItemIds} showBoundingBox={showBoundingBox} theme={theme} />
      <DimensioningOverlay boards={boards} selectedItemIds={selectedItemIds} showDimensions={showDimensions} units={units} theme={theme} />
    </group>
  );
}

export default function Viewport3D() {
  const { boards, groups, selectedItemIds, setSelectedItemIds, toggleSelection, gridSnap, theme, globalBounds, showEdges, showDimensions, showBoundingBox, units, constraintTargetMode, constraints, lighting, isOrtho, showGrid } = useStore();
  const [hoveredFaceData, setHoveredFaceData] = useState(null);
  const [modifierActive, setModifierActive] = useState(false);

  useEffect(() => {
    const handleKey = (e) => setModifierActive(e.shiftKey || e.altKey);
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKey);
    return () => { window.removeEventListener('keydown', handleKey); window.removeEventListener('keyup', handleKey); };
  }, []);

  const isDark = theme === 'dark';
  const majorColor = isDark ? 0x666666 : 0x999999;
  const minorColor = isDark ? 0x242424 : 0xd2d2d2;

  const gridRadius = 120;
  let minorDivs = 0, majorDivs = 20;

  if (gridSnap === '1/8 in') {
    minorDivs = 240;
    majorDivs = 40;
  } else if (gridSnap === '1/2 in' || gridSnap === '1 in') {
    minorDivs = 120;
    majorDivs = 20;
  } else if (gridSnap === 'off') {
    minorDivs = 0;
    majorDivs = 20;
  }

  return (
    <div className="viewport-container" style={{ width: '100%', height: '100%', position: 'relative' }}>

      <Canvas shadows={lighting?.shadows ? 'soft' : false} onPointerMissed={() => setSelectedItemIds([])}>
        <SceneLights lighting={lighting} />
        <ShadowFloor shadows={lighting?.shadows} />

        {/* Gizmo: R=Right(+X), L=Left(-X), U=Up(+Y), D=Down(-Y), F=Front(+Z), B=Back(-Z) */}
        <GizmoHelper alignment="top-center" margin={[0, 160]}>
          <CustomGizmoViewport />
        </GizmoHelper>

        {isOrtho ? (
          <OrthographicCamera makeDefault position={[30, 20, 40]} zoom={12} near={0.1} far={1000} />
        ) : (
          <PerspectiveCamera makeDefault position={[30, 20, 40]} near={0.1} far={1000} />
        )}

        <OrbitControls makeDefault />
        {/* Floor grid at Y=0 */}
        {showGrid && minorDivs > 0 && (
          <gridHelper key={`min_${minorDivs}_${theme}`} args={[gridRadius, minorDivs, minorColor, minorColor]} position={[0, -0.02, 0]} />
        )}
        {showGrid && <gridHelper key={`maj_${majorDivs}_${theme}`} args={[gridRadius, majorDivs, majorColor, majorColor]} position={[0, 0.02, 0]} />}
        {showGrid && <axesHelper args={[40]} position={[0, 0.03, 0]} />}
        {showGrid && <FloorFrontLabel />}

        {globalBounds?.enabled && (
          <mesh position={[0, globalBounds.y / 2, 0]} raycast={() => null}>
            <boxGeometry args={[globalBounds.x, globalBounds.y, globalBounds.z]} />
            <meshBasicMaterial color={theme === 'dark' ? '#bc8a5f' : '#FF9500'} wireframe transparent opacity={0.3} />
          </mesh>
        )}

        <React.Suspense fallback={null}>
          <WoodJoint
            boards={boards}
            groups={groups}
            selectedItemIds={selectedItemIds}
            toggleSelection={toggleSelection}
            showEdges={showEdges}
            showDimensions={showDimensions}
            showBoundingBox={showBoundingBox}
            units={units}
            theme={theme}
            constraintTargetMode={constraintTargetMode}
            hoveredFaceData={hoveredFaceData}
            setHoveredFaceData={setHoveredFaceData}
            modifierActive={modifierActive}
            constraints={constraints}
          />
        </React.Suspense>
      </Canvas>
    </div>
  );
}
