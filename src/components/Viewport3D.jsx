import React, { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera, OrthographicCamera, Html } from '@react-three/drei';
import useStore from '../store/useStore';

// Extracted Components
import { GizmoControls } from './GizmoControls';
import { GridEnvironment, ShadowFloor } from './GridEnvironment';
import BoardRenderer from './BoardRenderer';
import { PersistentControls } from './PersistentControls';
import { PrintCaptureHandler } from './PrintCaptureHandler';
import { AnimationDriver } from './AnimationDriver';
import { SceneLights } from './SceneLights';
import { ConstraintVisualizer } from './ConstraintVisualizer';
import { BoundingBoxVisualizer } from './BoundingBoxVisualizer';
import { MeasurementOverlay } from './MeasurementOverlay';
import { MeasureSnapPreview } from './MeasureSnapPreview';
import { MeasureDragHandler } from './MeasureDragHandler';

// ── Custom Pivot Snapping Preview ───────────────────────────────────────────
function PivotSnapPreview() {
  const pivotHoverSnap = useStore(s => s.pivotHoverSnap);
  if (!pivotHoverSnap) return null;
  return (
    <mesh position={pivotHoverSnap} raycast={() => null}>
      <sphereGeometry args={[0.15, 16, 16]} />
      <meshBasicMaterial color="#ff00ff" depthTest={false} transparent opacity={0.6} />
    </mesh>
  );
}

export default function Viewport3D() {
  const {
    boards,
    groups,
    selectedItemIds,
    setSelectedItemIds,
    toggleSelection,
    gridSnap,
    theme,
    globalBounds,
    showEdges,
    showMeasurements,
    measurements,
    showBoundingBox,
    units,
    constraintTargetMode,
    constraints,
    lighting,
    isOrtho,
    showGrid,
    cameraState,
    measureMode,
    setMeasureMode,
    printCapture
  } = useStore();

  const [hoveredFaceData, setHoveredFaceData] = useState(null);
  const [modifierActive, setModifierActive] = useState(false);

  // Read the persisted camera position once on mount so the declarative
  // <PerspectiveCamera> / <OrthographicCamera> starts at the saved position.
  const _defaultCamPos = [30, 20, 40];
  const _cameraPos = cameraState?.position ?? _defaultCamPos;

  useEffect(() => {
    const handleKey = (e) => {
      setModifierActive(e.shiftKey || e.altKey);
      if (e.key === 'Escape' && measureMode?.active) setMeasureMode(null);
      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.target.closest('input, textarea')) {
        const { selectedMeasurementId, removeMeasurement, setSelectedMeasurementId } = useStore.getState();
        if (selectedMeasurementId) {
          e.preventDefault();
          removeMeasurement(selectedMeasurementId);
          setSelectedMeasurementId(null);
        }
      }
    };
    const handleBlur = () => setModifierActive(false);   // reset if focus lost while Shift held
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKey);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKey);
      window.removeEventListener('blur', handleBlur);
    };
  }, [measureMode, setMeasureMode]);

  const workspaceSize = useStore(s => s.workspaceSize) || 120;

  return (
    <div className="viewport-container" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas shadows={lighting?.shadows ? 'soft' : false} onPointerMissed={() => setSelectedItemIds([])}>
        <SceneLights lighting={lighting} />
        {!printCapture && <ShadowFloor shadows={lighting?.shadows} />}

        <GizmoControls />

        {isOrtho ? (
          <OrthographicCamera makeDefault position={_cameraPos} zoom={12} near={0.1} far={1000} />
        ) : (
          <PerspectiveCamera makeDefault position={_cameraPos} near={0.1} far={1000} />
        )}

        <PersistentControls />
        <AnimationDriver />
        <MeasureDragHandler />
        <PrintCaptureHandler />

        <GridEnvironment 
          showGrid={showGrid}
          printCapture={printCapture}
          theme={theme}
          workspaceSize={workspaceSize}
          gridSnap={gridSnap}
          lighting={lighting}
          units={units}
        />

        {globalBounds?.enabled && !printCapture && (
          <mesh position={[0, globalBounds.y / 2, 0]} raycast={() => null}>
            <boxGeometry args={[globalBounds.x, globalBounds.y, globalBounds.z]} />
            <meshBasicMaterial color={theme === 'dark' ? '#bc8a5f' : '#FF9500'} wireframe transparent opacity={0.3} />
          </mesh>
        )}

        <Suspense fallback={
          <Html center>
            <div style={{ color: '#bc8a5f', fontSize: '1rem', fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
              Loading textures…
            </div>
          </Html>
        }>
          <BoardRenderer
            boards={boards}
            groups={groups}
            selectedItemIds={selectedItemIds}
            toggleSelection={toggleSelection}
            showEdges={showEdges}
            showMeasurements={showMeasurements}
            measurements={measurements}
            measureMode={measureMode}
            showBoundingBox={showBoundingBox}
            units={units}
            theme={theme}
            constraintTargetMode={constraintTargetMode}
            hoveredFaceData={hoveredFaceData}
            setHoveredFaceData={setHoveredFaceData}
            modifierActive={modifierActive}
            constraints={constraints}
          />
        </Suspense>

        <ConstraintVisualizer boards={boards} groups={groups} selectedItemIds={selectedItemIds} constraints={constraints} />
        <BoundingBoxVisualizer boards={boards} groups={groups} selectedItemIds={selectedItemIds} showBoundingBox={showBoundingBox} theme={theme} />
        <MeasurementOverlay boards={boards} selectedItemIds={selectedItemIds} showMeasurements={showMeasurements} measurements={measurements} units={units} theme={theme} />
        <MeasureSnapPreview boards={boards} measureMode={measureMode} />
        <PivotSnapPreview />
      </Canvas>
    </div>
  );
}
