import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera, OrthographicCamera, OrbitControls, useTexture, GizmoHelper, GizmoViewport, Text, Edges, Line, Html } from '@react-three/drei';
import * as THREE from 'three';

const getMatrix = (id, isBoard, boards, groups) => {
  let mat = new THREE.Matrix4();
  let cur = id; let isB = isBoard;
  while (cur) {
      let p = [0, 0, 0], r = [0, 0, 0], pId = null;
      if (isB) {
          const bb = boards.find(x => x.id.toString() === cur);
          if (bb) { p = bb.position || [0, 0, 0]; r = bb.rotation || [0, 0, 0]; pId = bb.parentId; }
          isB = false;
      } else {
          const g = groups[cur];
          if (g) { p = g.position || [0, 0, 0]; r = g.rotation || [0, 0, 0]; pId = g.parentId; }
      }
      mat.premultiply(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r, 'XYZ')), new THREE.Vector3(1, 1, 1)));
      cur = pId;
  }
  return mat;
};

const ConstraintVisualizer = ({ boards, groups, selectedItemIds }) => {
  const selectedBoards = boards.filter(b => selectedItemIds.includes(b.id.toString()) && b.constraints && b.constraints.length > 0);
  if (selectedBoards.length === 0) return null;

  return (
    <group>
      {selectedBoards.map(b => {
        const getFaceLocalPos = (bd, faceStr) => {
          if (!faceStr || !bd || !bd.size) return new THREE.Vector3(0, 0, 0);
          const w = bd.size[0] / 2;
          const h = bd.size[1] / 2;
          const d = bd.size[2] / 2;
          if (faceStr === 'x+') return new THREE.Vector3(w, 0, 0);
          if (faceStr === 'x-') return new THREE.Vector3(-w, 0, 0);
          if (faceStr === 'y+') return new THREE.Vector3(0, h, 0);
          if (faceStr === 'y-') return new THREE.Vector3(0, -h, 0);
          if (faceStr === 'z+') return new THREE.Vector3(0, 0, d);
          if (faceStr === 'z-') return new THREE.Vector3(0, 0, -d);
          return new THREE.Vector3(0, 0, 0);
        };

        return b.constraints.map((c, i) => {
          const targetBoard = boards.find(x => x.id.toString() === c.targetId.toString());
          const startMat = getMatrix(b.id.toString(), true, boards, groups);
          const startPos = getFaceLocalPos(b, c.sourceFace).applyMatrix4(startMat);

          const targetMat = getMatrix(c.targetId.toString(), true, boards, groups);
          const targetPos = getFaceLocalPos(targetBoard, c.targetFace).applyMatrix4(targetMat);
          
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

const DimensioningOverlay = ({ boards, groups, selectedItemIds, showDimensions, units, theme }) => {
  if (!showDimensions || selectedItemIds.length === 0) return null;
  const isDark = theme === 'dark';

  const formatUnit = (val) => {
    if (units === 'metric') return `${(val * 25.4).toFixed(1)}mm`;
    const frac = val % 1;
    let label = `${Math.floor(val)}`;
    if (frac > 0) label += ` ${Math.round(frac * 8)}/8`; // Simplified 1/8 increments
    return `${label}"`;
  };

  return (
    <group>
      {selectedItemIds.map(id => {
        const b = boards.find(x => x.id.toString() === id);
        if (!b) return null;
        
        // Find local bounds
        const extX = b.size[0] / 2;
        const extY = b.size[1] / 2;
        const extZ = b.size[2] / 2;
        
        const mat = getMatrix(id, true, boards, groups);
        
        const mapPt = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(mat).toArray();
        const color = isDark ? '#888888' : '#666666';
        const oY = 1.5;
        const oX = 1.5;

        // X (Width) floating above
        const xD = [mapPt(-extX, extY + oY, 0), mapPt(extX, extY + oY, 0)];
        const xT1 = [mapPt(-extX, extY + oY - 0.25, 0), mapPt(-extX, extY + oY + 0.25, 0)];
        const xT2 = [mapPt(extX, extY + oY - 0.25, 0), mapPt(extX, extY + oY + 0.25, 0)];

        // Y (Length) floating to right
        const yD = [mapPt(extX + oX, -extY, 0), mapPt(extX + oX, extY, 0)];
        const yT1 = [mapPt(extX + oX - 0.25, -extY, 0), mapPt(extX + oX + 0.25, -extY, 0)];
        const yT2 = [mapPt(extX + oX - 0.25, extY, 0), mapPt(extX + oX + 0.25, extY, 0)];

        // Z (Depth) floating below
        const zD = [mapPt(0, -extY - oY, -extZ), mapPt(0, -extY - oY, extZ)];
        const zT1 = [mapPt(0, -extY - oY - 0.25, -extZ), mapPt(0, -extY - oY + 0.25, -extZ)];
        const zT2 = [mapPt(0, -extY - oY - 0.25, extZ), mapPt(0, -extY - oY + 0.25, extZ)];

        const ptX = mapPt(0, extY + oY + 0.2, 0);
        const ptY = mapPt(extX + oX + 0.4, 0, 0);
        const ptZ = mapPt(0, -extY - oY - 0.2, 0);

        return (
          <group key={`dim_${id}`}>
             <Line points={xD} color={color} lineWidth={1.5} />
             <Line points={xT1} color={color} lineWidth={1.5} />
             <Line points={xT2} color={color} lineWidth={1.5} />
             <Html position={ptX} center style={{ pointerEvents: 'none', transition: 'all 0.1s' }}>
                <div style={{ color: isDark ? '#d0d0d0' : '#222222', fontSize: '0.75rem', fontWeight: 'bold' }}>W: {formatUnit(b.size[0])}</div>
             </Html>

             <Line points={yD} color={color} lineWidth={1.5} />
             <Line points={yT1} color={color} lineWidth={1.5} />
             <Line points={yT2} color={color} lineWidth={1.5} />
             <Html position={ptY} center style={{ pointerEvents: 'none', transition: 'all 0.1s' }}>
                <div style={{ color: isDark ? '#d0d0d0' : '#222222', fontSize: '0.75rem', fontWeight: 'bold' }}>L: {formatUnit(b.size[1])}</div>
             </Html>

             <Line points={zD} color={color} lineWidth={1.5} />
             <Line points={zT1} color={color} lineWidth={1.5} />
             <Line points={zT2} color={color} lineWidth={1.5} />
             <Html position={ptZ} center style={{ pointerEvents: 'none', transition: 'all 0.1s' }}>
                <div style={{ color: isDark ? '#d0d0d0' : '#222222', fontSize: '0.75rem', fontWeight: 'bold' }}>D: {formatUnit(b.size[2])}</div>
             </Html>
          </group>
        );
      })}
    </group>
  );
};

const BoundingBoxVisualizer = ({ boards, groups, selectedItemIds, showBoundingBox, theme }) => {
  if (!showBoundingBox || selectedItemIds.length === 0) return null;
  
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
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

  validBoards.forEach(b => {
      const mat = getMatrix(b.id.toString(), true, boards, groups);
      const w = b.size[0] / 2, h = b.size[1] / 2, d = b.size[2] / 2;
      const corners = [
          new THREE.Vector3(w, h, d), new THREE.Vector3(w, h, -d), new THREE.Vector3(w, -h, d), new THREE.Vector3(w, -h, -d),
          new THREE.Vector3(-w, h, d), new THREE.Vector3(-w, h, -d), new THREE.Vector3(-w, -h, d), new THREE.Vector3(-w, -h, -d)
      ];
      corners.forEach(v => {
          v.applyMatrix4(mat);
          if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
          if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
          if (v.z < minZ) minZ = v.z; if (v.z > maxZ) maxZ = v.z;
      });
  });

  const width = Math.abs(maxX - minX);
  const height = Math.abs(maxY - minY);
  const depth = Math.abs(maxZ - minZ);
  const centerX = minX + width / 2;
  const centerY = minY + height / 2;
  const centerZ = minZ + depth / 2;

  const isDark = theme === 'dark';
  return (
    <mesh position={[centerX, centerY, centerZ]}>
      <boxGeometry args={[width, height, depth]} />
      <meshBasicMaterial color={isDark ? '#00ffff' : '#007aff'} wireframe={true} transparent opacity={0.6} depthTest={false} />
    </mesh>
  );
};

const RecursiveNode = ({ nodeId, groups, boards, selectedItemIds, toggleSelection, textures, isParentSelected = false, showEdges, onDoubleClickItem, constraintTargetMode, hoveredFaceData, setHoveredFaceData }) => {
  const isGroup = groups[nodeId] !== undefined;
  const isSelected = selectedItemIds.includes(nodeId.toString()) || isParentSelected;

  if (!isGroup) {
    const b = boards.find(x => x.id.toString() === nodeId);
    if (!b || b.visible === false) return null;
    return (
      <mesh
        position={b.position}
        rotation={b.rotation || [0, 0, 0]}
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
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (onDoubleClickItem) onDoubleClickItem(b.id.toString());
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
          const px = w, pnx = -w, py = h, pny = -h, pz = d, pnz = -d;
          if (faceStr === 'x+') { pos = [px, 0, 0]; rot = [0, Math.PI / 2, 0]; }
          if (faceStr === 'x-') { pos = [pnx, 0, 0]; rot = [0, -Math.PI / 2, 0]; }
          if (faceStr === 'y+') { pos = [0, py, 0]; rot = [-Math.PI / 2, 0, 0]; }
          if (faceStr === 'y-') { pos = [0, pny, 0]; rot = [Math.PI / 2, 0, 0]; }
          if (faceStr === 'z+') { pos = [0, 0, pz]; rot = [0, 0, 0]; }
          if (faceStr === 'z-') { pos = [0, 0, pnz]; rot = [0, Math.PI, 0]; }
          
          let planeW = faceStr.startsWith('x') ? b.size[2] : b.size[0];
          let planeH = faceStr.startsWith('y') ? b.size[2] : b.size[1];
          if (faceStr.startsWith('x')) planeH = b.size[1];
          if (faceStr.startsWith('z')) planeH = b.size[1];

          // Determine global normal to label the face
          const mat = getMatrix(b.id.toString(), true, boards, groups);
          const normalMatrix = new THREE.Matrix3().getNormalMatrix(mat);
          const localNormal = new THREE.Vector3();
          if (faceStr === 'x+') localNormal.set(1, 0, 0);
          if (faceStr === 'x-') localNormal.set(-1, 0, 0);
          if (faceStr === 'y+') localNormal.set(0, 1, 0);
          if (faceStr === 'y-') localNormal.set(0, -1, 0);
          if (faceStr === 'z+') localNormal.set(0, 0, 1);
          if (faceStr === 'z-') localNormal.set(0, 0, -1);
          
          localNormal.applyMatrix3(normalMatrix).normalize();
          
          const epsilon = 0.01;
          let tooltipLabel = 'not coplanar';
          
          if (localNormal.y > 1 - epsilon) tooltipLabel = "top";
          else if (localNormal.y < -1 + epsilon) tooltipLabel = "bottom";
          else if (localNormal.x > 1 - epsilon) tooltipLabel = "right";
          else if (localNormal.x < -1 + epsilon) tooltipLabel = "left";
          else if (localNormal.z > 1 - epsilon) tooltipLabel = "front";
          else if (localNormal.z < -1 + epsilon) tooltipLabel = "back";

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
  }

  const g = groups[nodeId];
  if (g.visible === false) return null;

  const childGroups = Object.keys(groups).filter(k => groups[k].parentId === nodeId);
  const childBoards = boards.filter(b => b.parentId === nodeId);

  return (
    <group position={g.position || [0, 0, 0]} rotation={g.rotation || [0, 0, 0]}>
      {childGroups.map(k => (
        <RecursiveNode key={k} nodeId={k} groups={groups} boards={boards} selectedItemIds={selectedItemIds} toggleSelection={toggleSelection} textures={textures} isParentSelected={isSelected} showEdges={showEdges} onDoubleClickItem={onDoubleClickItem} constraintTargetMode={constraintTargetMode} hoveredFaceData={hoveredFaceData} setHoveredFaceData={setHoveredFaceData} />
      ))}
      {childBoards.map(b => (
        <RecursiveNode key={`b_${b.id}`} nodeId={b.id.toString()} groups={groups} boards={boards} selectedItemIds={selectedItemIds} toggleSelection={toggleSelection} textures={textures} isParentSelected={isSelected} showEdges={showEdges} onDoubleClickItem={onDoubleClickItem} constraintTargetMode={constraintTargetMode} hoveredFaceData={hoveredFaceData} setHoveredFaceData={setHoveredFaceData} />
      ))}
    </group>
  );
};

function WoodJoint({ boards, groups, selectedItemIds, toggleSelection, showEdges, showDimensions, showBoundingBox, units, theme, onDoubleClickItem, constraintTargetMode, hoveredFaceData, setHoveredFaceData }) {
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
        <RecursiveNode key={k} nodeId={k} groups={groups} boards={boards} selectedItemIds={selectedItemIds} toggleSelection={toggleSelection} textures={textures} showEdges={showEdges} onDoubleClickItem={onDoubleClickItem} constraintTargetMode={constraintTargetMode} hoveredFaceData={hoveredFaceData} setHoveredFaceData={setHoveredFaceData} />
      ))}
      <ConstraintVisualizer boards={boards} groups={groups} selectedItemIds={selectedItemIds} />
      <BoundingBoxVisualizer boards={boards} groups={groups} selectedItemIds={selectedItemIds} showBoundingBox={showBoundingBox} theme={theme} />
      <DimensioningOverlay boards={boards} groups={groups} selectedItemIds={selectedItemIds} showDimensions={showDimensions} units={units} theme={theme} />
    </group>
  );
}

export default function Viewport3D({ boards, groups, selectedItemIds, setSelectedItemIds, toggleSelection, gridSnap = '1/8 in', theme = 'light', globalBounds, showEdges, showDimensions, showBoundingBox, units, onDoubleClickItem, constraintTargetMode }) {
  const [isOrtho, setIsOrtho] = useState(false);
  const [hoveredFaceData, setHoveredFaceData] = useState(null);

  const isDark = theme === 'dark';
  const majorColor = isDark ? 0x666666 : 0x999999;
  const minorColor = isDark ? 0x242424 : 0xd2d2d2;

  const gridRadius = 120; // 10 foot workspace span balances integers perfectly for both 6 and 12-inch divides.
  let minorDivs = 0, majorDivs = 20; // Default off layout

  if (gridSnap === '1/8 in') {
    minorDivs = 240;
    majorDivs = 40;  // 3 inch boundaries
  } else if (gridSnap === '1/2 in' || gridSnap === '1 in') {
    minorDivs = 120;
    majorDivs = 20;  // 6 inch boundaries
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

        <GizmoHelper alignment="top-center" margin={[0, 160]}>
          <GizmoViewport axisColors={['#ff3b30', '#34c759', '#007aff']} labelColor="white" labels={['R', 'U', 'F']} />
        </GizmoHelper>

        {isOrtho ? (
          <OrthographicCamera makeDefault position={[30, 20, 40]} zoom={12} near={0.1} far={1000} />
        ) : (
          <PerspectiveCamera makeDefault position={[30, 20, 40]} near={0.1} far={1000} />
        )}

        <OrbitControls makeDefault />
        {/* Draw faint Minor grid on the true floor plane */}
        {minorDivs > 0 && (
          <gridHelper key={`min_${minorDivs}_${theme}`} args={[gridRadius, minorDivs, minorColor, minorColor]} position={[0, -3.02, 0]} />
        )}
        {/* Draw bold Major grid slightly above to guarantee strict anti-aliasing dominance */}
        <gridHelper key={`maj_${majorDivs}_${theme}`} args={[gridRadius, majorDivs, majorColor, majorColor]} position={[0, -2.98, 0]} />
        <axesHelper args={[40]} position={[0, -2.97, 0]} />

        {globalBounds?.enabled && (
          <mesh position={[0, -3 + (globalBounds.y / 2), 0]}>
            <boxGeometry args={[globalBounds.x, globalBounds.y, globalBounds.z]} />
            <meshBasicMaterial color={theme === 'dark' ? '#bc8a5f' : '#FF9500'} wireframe transparent opacity={0.3} />
          </mesh>
        )}

        {globalBounds?.enabled && (
          <mesh position={[0, -3 + (globalBounds.y / 2), 0]}>
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
            onDoubleClickItem={onDoubleClickItem}
            constraintTargetMode={constraintTargetMode}
            hoveredFaceData={hoveredFaceData}
            setHoveredFaceData={setHoveredFaceData}
          />
        </React.Suspense>
      </Canvas>
    </div>
  );
}
