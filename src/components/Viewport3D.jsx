import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera, OrthographicCamera, OrbitControls, useTexture, GizmoHelper, GizmoViewport, Text, Edges, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import useStore from '../store/useStore';
import { computeWorldAABB, collectChildBoards, calculateGroupAABB } from '../utils/sceneGraph';
import { formatUnit } from '../utils/units';



const ConstraintVisualizer = ({ boards, groups, selectedItemIds }) => {
  const selectedBoards = boards.filter(b => selectedItemIds.includes(b.id.toString()) && b.constraints && b.constraints.length > 0);
  if (selectedBoards.length === 0) return null;

  return (
    <group>
      {selectedBoards.map(b => {
        const getFaceWorldPos = (bd, faceStr) => {
          if (!faceStr || !bd || !bd.size) return new THREE.Vector3(0, 0, 0);
          const pos = new THREE.Vector3(...bd.position);
          const axisChar = faceStr[0];
          const sign = faceStr[1] === '+' ? 1 : -1;
          if (axisChar === 'x') pos.x += (bd.size[0] / 2) * sign;
          if (axisChar === 'y') pos.y += (bd.size[1] / 2) * sign;
          if (axisChar === 'z') pos.z += (bd.size[2] / 2) * sign;
          return pos;
        };

        return b.constraints.map((c, i) => {
          const targetBoard = boards.find(x => x.id.toString() === c.targetId.toString());
          const startPos = getFaceWorldPos(b, c.sourceFace);
          const targetPos = getFaceWorldPos(targetBoard, c.targetFace);
          
          const midPos = startPos.clone().lerp(targetPos, 0.5);

          return (
            <group key={`c_${b.id}_${i}`}>
              <Line
                points={[startPos, targetPos]}
                color={c.enabled === false ? "#888888" : "#00ffff"}
                lineWidth={3}
                dashed={c.enabled !== false}
                dashScale={10}
                dashSize={1}
                dashOffset={0}
              />
              <Html position={midPos.toArray()} center style={{ pointerEvents: 'none', zIndex: c.enabled === false ? 0 : 1 }}>
                <div style={{
                  background: c.enabled === false ? 'rgba(136, 136, 136, 0.8)' : 'var(--accent-color)',
                  color: 'white',
                  padding: '2px 6px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                  whiteSpace: 'nowrap',
                  opacity: c.enabled === false ? 0.7 : 1
                }}>
                  {c.enabled === false ? '🔓' : '🔒'} {c.type}
                </div>
              </Html>
            </group>
          );
        });
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
      raycast={modifierActive ? () => null : undefined}
      position={b.position}
      onClick={(e) => {
        e.stopPropagation();
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
      <boxGeometry args={b.size} />
      <meshStandardMaterial
        map={textures[b.material]}
        roughness={0.8}
        emissive={isSelected ? '#bc8a5f' : '#000000'}
        emissiveIntensity={isSelected ? 0.4 : 0}
      />
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

function WoodJoint({ boards, groups, selectedItemIds, toggleSelection, showEdges, showDimensions, showBoundingBox, units, theme, constraintTargetMode, hoveredFaceData, setHoveredFaceData, modifierActive }) {
  const textures = useTexture({
    'pine': '/textures/pine.svg',
    'cherry': '/textures/cherry.svg',
    'walnut': '/textures/walnut.svg',
    'red-oak': '/textures/red-oak.svg',
    'white-oak': '/textures/white-oak.svg'
  });

  Object.values(textures).forEach(t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  });

  const rootGroups = Object.keys(groups).filter(k => groups[k].parentId === null);

  return (
    <group>
      {rootGroups.map(k => (
        <RecursiveNode key={k} nodeId={k} groups={groups} boards={boards} selectedItemIds={selectedItemIds} toggleSelection={toggleSelection} textures={textures} showEdges={showEdges} constraintTargetMode={constraintTargetMode} hoveredFaceData={hoveredFaceData} setHoveredFaceData={setHoveredFaceData} modifierActive={modifierActive} />
      ))}
      <ConstraintVisualizer boards={boards} groups={groups} selectedItemIds={selectedItemIds} />
      <BoundingBoxVisualizer boards={boards} groups={groups} selectedItemIds={selectedItemIds} showBoundingBox={showBoundingBox} theme={theme} />
      <DimensioningOverlay boards={boards} selectedItemIds={selectedItemIds} showDimensions={showDimensions} units={units} theme={theme} />
    </group>
  );
}

export default function Viewport3D() {
  const { boards, groups, selectedItemIds, setSelectedItemIds, toggleSelection, gridSnap, theme, globalBounds, showEdges, showDimensions, showBoundingBox, units, constraintTargetMode } = useStore();
  const [isOrtho, setIsOrtho] = useState(false);
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
      <div className="view-toolbar" style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, display: 'flex', gap: '8px', background: 'var(--panel-bg)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', alignItems: 'center' }}>
        <button
          className="camera-toggle-btn"
          onClick={() => setIsOrtho(!isOrtho)}
          style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'none', border: 'none', color: isOrtho ? 'var(--accent-color)' : 'var(--text-main)', boxShadow: 'none' }}
        >
          {isOrtho ? 'Ortho' : 'Persp'}
        </button>
        <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 4px' }}></div>
        {['Top', 'Front', 'Side'].map(v => (
          <button
            key={v}
            className="camera-toggle-btn"
            onClick={() => setIsOrtho(true)}
            style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'none', border: 'none', color: 'var(--text-main)', boxShadow: 'none' }}
          >
            {v}
          </button>
        ))}
      </div>

      <Canvas onPointerMissed={() => setSelectedItemIds([])}>
        <ambientLight intensity={0.4} />
        <pointLight position={[20, 20, 20]} intensity={1} />

        {/* Gizmo: R=Red(X left/right), G=Green(Y up/down), B=Blue(Z front/back) */}
        <GizmoHelper alignment="top-center" margin={[0, 160]}>
          <GizmoViewport axisColors={['#ff3b30', '#34c759', '#007aff']} labelColor="white" labels={['X', 'Y', 'Z']} />
        </GizmoHelper>

        {isOrtho ? (
          <OrthographicCamera makeDefault position={[30, 20, 40]} zoom={12} near={0.1} far={1000} />
        ) : (
          <PerspectiveCamera makeDefault position={[30, 20, 40]} near={0.1} far={1000} />
        )}

        <OrbitControls makeDefault />
        {/* Floor grid at Y=0 */}
        {minorDivs > 0 && (
          <gridHelper key={`min_${minorDivs}_${theme}`} args={[gridRadius, minorDivs, minorColor, minorColor]} position={[0, -0.02, 0]} />
        )}
        <gridHelper key={`maj_${majorDivs}_${theme}`} args={[gridRadius, majorDivs, majorColor, majorColor]} position={[0, 0.02, 0]} />
        <axesHelper args={[40]} position={[0, 0.03, 0]} />

        {globalBounds?.enabled && (
          <mesh position={[0, globalBounds.y / 2, 0]}>
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
          />
        </React.Suspense>
      </Canvas>
    </div>
  );
}
