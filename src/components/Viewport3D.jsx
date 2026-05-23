import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, OrthographicCamera, OrbitControls, useTexture, useGLTF, Text, Billboard, Edges, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import useStore from '../store/useStore';
import { computeWorldAABB, collectChildBoards, calculateGroupAABB } from '../utils/sceneGraph';
import { formatUnit } from '../utils/units';

// Extracted Components
import { GizmoControls } from './GizmoControls';
import { GridEnvironment, ShadowFloor } from './GridEnvironment';
import BoardRenderer from './BoardRenderer';
import { findNearestSnap } from '../utils/snapHelpers';

// ── Persistent Controls Wrapper ────────────
// Restores the orbit target from persisted state and captures camera
// position + target on every interaction end.  The camera *position*
// is handled by the declarative <PerspectiveCamera>/<OrthographicCamera>
// which already reads its initial value from the store.
function PersistentControls() {
  const { camera } = useThree();
  const cameraState = useStore(s => s.cameraState);
  const setCameraState = useStore(s => s.setCameraState);

  const controlsRef = React.useRef(null);
  // Track which cameraState object we last applied so we don't re-apply
  // the same value (which would fight user interaction).
  const appliedRef = React.useRef(null);

  // When cameraState changes (e.g. workspace load), apply it.
  React.useEffect(() => {
    const ctrls = controlsRef.current;
    if (ctrls && cameraState && appliedRef.current !== cameraState) {
      camera.position.set(...cameraState.position);
      ctrls.target.set(...cameraState.target);
      ctrls.update();
      appliedRef.current = cameraState;
    }
  }, [camera, cameraState]);

  const handleEnd = React.useCallback((e) => {
    const ctrls = e.target;
    if (!ctrls) return;
    const newState = {
      position: [camera.position.x, camera.position.y, camera.position.z],
      target:   [ctrls.target.x,    ctrls.target.y,    ctrls.target.z],
    };
    appliedRef.current = newState;
    setCameraState(newState);
  }, [camera, setCameraState]);

  // Ref-callback: fires once when OrbitControls mounts.
  // Sets the orbit target from persisted state (position is already
  // correct because the declarative camera read it from the store).
  const initRef = React.useCallback((ctrls) => {
    controlsRef.current = ctrls;
    if (ctrls && cameraState && appliedRef.current !== cameraState) {
      camera.position.set(...cameraState.position);
      ctrls.target.set(...cameraState.target);
      ctrls.update();
      appliedRef.current = cameraState;
    }
  }, [camera, cameraState]);

  const isDraggingMeasure = useStore(s => s.measureMode?.dragging);

  return <OrbitControls ref={initRef} makeDefault onEnd={handleEnd} enabled={!isDraggingMeasure} />;
}

// ── Print Capture Handler ──────────────────────────────────────────
// Lives inside Canvas. Watches for printCapture state and performs
// off-screen render using WebGLRenderTarget.
function PrintCaptureHandler() {
  const { gl, scene, camera } = useThree();
  const printCapture = useStore(s => s.printCapture);
  const setPrintCapture = useStore(s => s.setPrintCapture);

  useEffect(() => {
    if (!printCapture) return;

    const doCapture = () => {
      const { resolution, framing, renderMode } = printCapture;
      const state = useStore.getState();
      const { boards, selectedItemIds } = state;

      // ── Framing ──
      let savedPos;
      if (framing === 'fitAll' || framing === 'fitSelection') {
        const targetBoards = framing === 'fitSelection' && selectedItemIds.length > 0
          ? boards.filter(b => selectedItemIds.includes(b.id.toString()))
          : boards.filter(b => b.visible !== false);

        if (targetBoards.length > 0) {
          const bbox = new THREE.Box3();
          targetBoards.forEach(b => {
            const hx = b.size[0]/2, hy = b.size[1]/2, hz = b.size[2]/2;
            const p = b.position;
            bbox.expandByPoint(new THREE.Vector3(p[0]-hx, p[1]-hy, p[2]-hz));
            bbox.expandByPoint(new THREE.Vector3(p[0]+hx, p[1]+hy, p[2]+hz));
          });
          const center = new THREE.Vector3();
          bbox.getCenter(center);
          const size = new THREE.Vector3();
          bbox.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          const dist = maxDim * 1.8;

          savedPos = camera.position.clone();
          const dir = camera.position.clone().sub(center).normalize();
          camera.position.copy(center.clone().add(dir.multiplyScalar(dist)));
          camera.lookAt(center);
          camera.updateProjectionMatrix();
        }
      }

      // ── Scene modifications for print ──
      const origBackground = scene.background;
      scene.background = new THREE.Color('#ffffff');

      // Hide grid helpers, gizmo, and other non-printable objects
      const hiddenObjects = [];
      scene.traverse(obj => {
        if (obj.isGridHelper || obj.type === 'GridHelper') {
          if (obj.visible) { hiddenObjects.push(obj); obj.visible = false; }
        }
      });
      scene.children.forEach(child => {
        const isGizmo = child.type === 'GizmoHelper' || child.isGizmoHelper ||
          (child.children && child.children.some(c => c.type === 'GizmoHelper' || c.isGizmoHelper));
        if (isGizmo && child.visible) {
          hiddenObjects.push(child);
          child.visible = false;
        }
      });

      // Strip selection emissive highlights
      const emissiveRestores = [];
      scene.traverse(obj => {
        if (obj.isMesh && obj.material && obj.material.emissiveIntensity > 0) {
          emissiveRestores.push({ mesh: obj, intensity: obj.material.emissiveIntensity });
          obj.material.emissiveIntensity = 0;
        }
      });

      // ── Render mode: wireframe / light (ink saver) ──
      const materialRestores = [];
      if (renderMode === 'wireframe' || renderMode === 'light') {
        scene.traverse(obj => {
          if (obj.isMesh && obj.material && !obj.material._isPrintHelper) {
            // Skip measurement overlay objects (lines + text)
            let prot = false;
            let p = obj;
            while (p) { if (p.userData?.printProtected) { prot = true; break; } p = p.parent; }
            if (prot) return;
            const mat = obj.material;
            const saved = {
              mesh: obj,
              wireframe: mat.wireframe,
              opacity: mat.opacity,
              transparent: mat.transparent,
              color: mat.color ? mat.color.clone() : null,
            };
            materialRestores.push(saved);

            if (renderMode === 'wireframe') {
              mat.wireframe = true;
              if (mat.color) mat.color.set('#333333');
              mat.opacity = 1;
              mat.transparent = false;
            } else if (renderMode === 'light') {
              mat.opacity = 0.15;
              mat.transparent = true;
            }
          }
        });
      }

      // ── Render to off-screen target ──
      const cssW = gl.domElement.clientWidth || gl.domElement.width;
      const cssH = gl.domElement.clientHeight || gl.domElement.height;
      const targetW = Math.floor(cssW * resolution);
      const targetH = Math.floor(cssH * resolution);

      const renderTarget = new THREE.WebGLRenderTarget(targetW, targetH, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
      });

      gl.setRenderTarget(renderTarget);
      gl.render(scene, camera);
      gl.setRenderTarget(null);

      // Read pixels
      const pixels = new Uint8Array(targetW * targetH * 4);
      gl.readRenderTargetPixels(renderTarget, 0, 0, targetW, targetH, pixels);
      renderTarget.dispose();

      // Convert to canvas (flip Y — WebGL is bottom-up)
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      const imageData = ctx.createImageData(targetW, targetH);
      for (let y = 0; y < targetH; y++) {
        const srcRow = (targetH - 1 - y) * targetW * 4;
        const dstRow = y * targetW * 4;
        for (let x = 0; x < targetW * 4; x++) {
          imageData.data[dstRow + x] = pixels[srcRow + x];
        }
      }
      ctx.putImageData(imageData, 0, 0);

      // ── Restore scene ──
      scene.background = origBackground;
      hiddenObjects.forEach(obj => { obj.visible = true; });
      emissiveRestores.forEach(({ mesh, intensity }) => { mesh.material.emissiveIntensity = intensity; });
      materialRestores.forEach(({ mesh, wireframe, opacity, transparent, color }) => {
        mesh.material.wireframe = wireframe;
        mesh.material.opacity = opacity;
        mesh.material.transparent = transparent;
        if (color) mesh.material.color.copy(color);
      });
      if (savedPos) {
        camera.position.copy(savedPos);
        camera.updateProjectionMatrix();
      }

      // ── Output: open in new window ──
      const dataURL = canvas.toDataURL('image/png');
      const fileName = (state.currentFileName || 'woodcraft').replace(/[^a-zA-Z0-9]/g, '_');
      const isLandscape = targetW > targetH;
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.write(`<!DOCTYPE html><html><head><title>Print — ${state.currentFileName || 'Woodcraft'}</title>
<style>
@page{size:${isLandscape ? 'landscape' : 'portrait'};margin:0.25in}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%}
body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f0f0f0;padding:24px}
img{max-width:100%;height:auto;box-shadow:0 4px 20px rgba(0,0,0,.15);border-radius:4px}
.bar{position:fixed;top:16px;right:16px;display:flex;gap:8px;z-index:10}
.bar button{padding:10px 20px;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,.15)}
.p{background:#007aff;color:#fff}.d{background:#34c759;color:#fff}
.info{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);font:12px system-ui;color:#888}
@media print{
  .bar,.info{display:none!important}
  body{background:#fff;padding:0;display:block;min-height:auto}
  img{width:100%;height:auto;max-width:none;max-height:none;box-shadow:none;border-radius:0;display:block}
}
</style></head><body>
<img src="${dataURL}" />
<div class="bar">
<button class="p" onclick="window.print()">🖨️ Print</button>
<button class="d" onclick="var a=document.createElement('a');a.href=document.querySelector('img').src;a.download='${fileName}.png';a.click()">💾 Download PNG</button>
</div>
<div class="info">${targetW} × ${targetH} px · ${resolution}× · ${renderMode}</div>
</body></html>`);
        printWin.document.close();
      }

      setPrintCapture(null);
    };

    // Delay two frames so pending scene changes render first
    requestAnimationFrame(() => requestAnimationFrame(doCapture));
  }, [printCapture]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// ── Animation Driver ────────────────────────────────────────────────
// Runs inside Canvas via useFrame for 60fps board interpolation
// and camera turntable orbit.  Reads store via getState() to avoid
// stale closure issues with pause/reset.
function AnimationDriver() {
  const { camera } = useThree();

  // Easing functions
  const ease = (t, type) => {
    switch (type) {
      case 'ease-in':     return t * t;
      case 'ease-out':    return t * (2 - t);
      case 'ease-in-out': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      default:            return t; // linear
    }
  };

  // Track bounce direction: 1 = forward, -1 = backward
  const dirRef = React.useRef(1);

  useFrame((_, delta) => {
    // Always read FRESH state from the store
    const state = useStore.getState();
    const { boardAnim, turntable } = state.animation || {};
    if (!boardAnim || !turntable) return;

    // ── Board animation ─────────────────────────────────────
    if (boardAnim.playing && boardAnim.start && boardAnim.end && boardAnim.boardId) {
      const duration = boardAnim.duration || 2;
      const increment = (delta / duration) * dirRef.current;
      let newProgress = boardAnim.progress + increment;
      let stillPlaying = true;

      if (newProgress >= 1) {
        if (boardAnim.loop) {
          if (boardAnim.bounce) {
            newProgress = 1;
            dirRef.current = -1; // reverse
          } else {
            newProgress = 0; // restart
          }
        } else {
          newProgress = 1;
          stillPlaying = false;
        }
      } else if (newProgress <= 0 && boardAnim.bounce) {
        newProgress = 0;
        dirRef.current = 1; // forward again
        if (!boardAnim.loop) {
          stillPlaying = false;
        }
      }

      const eased = ease(Math.max(0, Math.min(1, newProgress)), boardAnim.easing);

      // Lerp orientation
      const startOri = boardAnim.start.orientation;
      const endOri = boardAnim.end.orientation;
      const lerpedOri = [
        startOri[0] + (endOri[0] - startOri[0]) * eased,
        startOri[1] + (endOri[1] - startOri[1]) * eased,
        startOri[2] + (endOri[2] - startOri[2]) * eased,
      ];

      // Lerp pivot if both have it
      const startPiv = boardAnim.start.pivot || [0, 0, 0];
      const endPiv = boardAnim.end.pivot || [0, 0, 0];
      const lerpedPiv = [
        startPiv[0] + (endPiv[0] - startPiv[0]) * eased,
        startPiv[1] + (endPiv[1] - startPiv[1]) * eased,
        startPiv[2] + (endPiv[2] - startPiv[2]) * eased,
      ];
      const hasPiv = lerpedPiv[0] !== 0 || lerpedPiv[1] !== 0 || lerpedPiv[2] !== 0;

      // Apply to board
      state.setBoards(prev => prev.map(b => {
        if (b.id.toString() !== boardAnim.boardId) return b;
        return {
          ...b,
          orientation: lerpedOri,
          pivot: hasPiv ? lerpedPiv : undefined,
        };
      }));

      // Update progress
      state.setAnimation(prev => ({
        ...prev,
        boardAnim: { ...prev.boardAnim, progress: newProgress, playing: stillPlaying },
      }));
    } else {
      // Reset direction when not playing
      dirRef.current = 1;
    }

    // ── Camera turntable ────────────────────────────────────
    if (turntable.playing) {
      const rpm = turntable.speed || 6;
      const angularSpeed = (rpm * 2 * Math.PI) / 60; // radians per second
      const angle = angularSpeed * delta;

      // Rotate camera position around Y-axis, keeping current radius and height
      const cx = camera.position.x;
      const cz = camera.position.z;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      camera.position.x = cx * cosA - cz * sinA;
      camera.position.z = cx * sinA + cz * cosA;
      camera.position.y = turntable.height;
      camera.lookAt(0, turntable.height * 0.3, 0);
    }
  });

  return null;
}

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

// ── Unified Measurement Overlay ──────────────────────────────────────────────
// Renders ephemeral auto-dims for selected boards (muted gray) and persistent
// custom measurements (orange). Uses drei <Text> for WebGL-native labels
// (printable, no DOM overlays).
const MeasurementOverlay = ({ boards, selectedItemIds, showMeasurements, measurements, units, theme }) => {
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
};

// ── Measure Mode: Hover snap preview + first point marker ────────────────────
const MeasureSnapPreview = ({ boards, measureMode }) => {
  const measureHoverSnap = useStore(s => s.measureHoverSnap);
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
        const units = useStore.getState().units;
        return (
          <group>
            {/* Leader lines */}
            <Line points={[wA, oA]} color="#ff9f0a" lineWidth={1} depthTest={false} renderOrder={4} />
            <Line points={[wB, oB]} color="#ff9f0a" lineWidth={1} depthTest={false} renderOrder={4} />
            {/* Dimension line */}
            <Line points={[oA, oB]} color="#ff9f0a" lineWidth={2.5} depthTest={false} renderOrder={4} />
            {/* End ticks */}
            {(() => {
              const measDir = new THREE.Vector3(wB[0]-wA[0], wB[1]-wA[1], wB[2]-wA[2]).normalize();
              const tickDir = new THREE.Vector3(...dir);
              const tickLen = 0.4;
              const tA1 = [oA[0]-tickDir.x*tickLen, oA[1]-tickDir.y*tickLen, oA[2]-tickDir.z*tickLen];
              const tA2 = [oA[0]+tickDir.x*tickLen, oA[1]+tickDir.y*tickLen, oA[2]+tickDir.z*tickLen];
              const tB1 = [oB[0]-tickDir.x*tickLen, oB[1]-tickDir.y*tickLen, oB[2]-tickDir.z*tickLen];
              const tB2 = [oB[0]+tickDir.x*tickLen, oB[1]+tickDir.y*tickLen, oB[2]+tickDir.z*tickLen];
              return (
                <>
                  <Line points={[tA1, tA2]} color="#ff9f0a" lineWidth={1.5} depthTest={false} renderOrder={4} />
                  <Line points={[tB1, tB2]} color="#ff9f0a" lineWidth={1.5} depthTest={false} renderOrder={4} />
                </>
              );
            })()}
            <Billboard position={mid}>
              <Text fontSize={0.9} color="#ff9f0a" anchorX="center" anchorY="bottom" renderOrder={5} material-depthTest={false} outlineWidth={0.04} outlineColor="#000000">
                {formatUnit(dist, units)}
              </Text>
            </Billboard>
          </group>
        );
      })()}
    </group>
  );
};

// ── Drag handler for offset dimension lines ──────────────────────────────────
// Lives inside Canvas, uses useThree() for camera access.
// Listens for window pointer events during drag mode.
const MeasureDragHandler = () => {
  const { camera, gl } = useThree();
  const measureMode = useStore(s => s.measureMode);
  const boards = useStore(s => s.boards);

  useEffect(() => {
    if (!measureMode?.dragging) return;
    const { firstPoint, secondPoint, offsetDirA, offsetDirB } = measureMode;
    if (!firstPoint || !secondPoint || !offsetDirA) return;

    // Compute world positions
    const toWorldVec = (lo, boardId) => {
      const board = boards.find(b => b.id.toString() === boardId);
      if (!board) return new THREE.Vector3();
      const euler = new THREE.Euler(...(board.orientation || [0, 0, 0]), 'YXZ');
      const pivot = board.pivot || [0, 0, 0];
      const pt = new THREE.Vector3(lo[0]-pivot[0], lo[1]-pivot[1], lo[2]-pivot[2]);
      pt.applyEuler(euler);
      return new THREE.Vector3(pt.x+board.position[0], pt.y+board.position[1], pt.z+board.position[2]);
    };

    const wA = toWorldVec(firstPoint.localOffset, firstPoint.boardId);
    const wB = toWorldVec(secondPoint.localOffset, secondPoint.boardId);
    const midpoint = new THREE.Vector3().addVectors(wA, wB).multiplyScalar(0.5);

    const camDir = camera.getWorldDirection(new THREE.Vector3());
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, midpoint);
    const raycaster = new THREE.Raycaster();

    const dirA = new THREE.Vector3(...offsetDirA);
    const dirB = offsetDirB ? new THREE.Vector3(...offsetDirB) : dirA.clone();

    // Track Shift state independently — e.shiftKey on pointermove can go stale
    let shiftHeld = false;
    let lastClientX = 0, lastClientY = 0;

    const updateOffset = (useShift) => {
      const activeDir = useShift ? dirB : dirA;
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((lastClientX - rect.left) / rect.width) * 2 - 1,
        -((lastClientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      const hitPoint = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(plane, hitPoint)) {
        const delta = hitPoint.clone().sub(midpoint);
        const offset = delta.dot(activeDir);
        useStore.getState().setMeasureMode({
          ...useStore.getState().measureMode,
          dragOffset: offset,
          offsetDir: [activeDir.x, activeDir.y, activeDir.z],
        });
      }
    };

    const onMove = (e) => {
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      shiftHeld = e.shiftKey;
      updateOffset(shiftHeld);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Shift' && !shiftHeld) {
        shiftHeld = true;
        updateOffset(true);
      }
    };

    const onKeyUp = (e) => {
      if (e.key === 'Shift' && shiftHeld) {
        shiftHeld = false;
        updateOffset(false);
      }
    };

    const onUp = () => {
      const state = useStore.getState();
      const mm = state.measureMode;
      if (mm?.firstPoint && mm?.secondPoint) {
        state.addMeasurement(mm.firstPoint, mm.secondPoint, mm.dragOffset || 0, mm.offsetDir);
      }
      state.setMeasureMode({ active: true, firstPoint: null });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [measureMode?.dragging]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
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

export default function Viewport3D() {
  const { boards, groups, selectedItemIds, setSelectedItemIds, toggleSelection, gridSnap, theme, globalBounds, showEdges, showMeasurements, measurements, showBoundingBox, units, constraintTargetMode, constraints, lighting, isOrtho, showGrid, cameraState, measureMode, setMeasureMode, printCapture } = useStore();
  const [hoveredFaceData, setHoveredFaceData] = useState(null);
  const [modifierActive, setModifierActive] = useState(false);

  // Read the persisted camera position once on mount so the declarative
  // <PerspectiveCamera> / <OrthographicCamera> starts at the saved position
  // instead of the hardcoded default.  We memoise on the reference so it
  // only changes when a workspace is loaded (setCameraState produces a new object).
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
  }, []);

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

        <React.Suspense fallback={
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
        </React.Suspense>

        <ConstraintVisualizer boards={boards} groups={groups} selectedItemIds={selectedItemIds} constraints={constraints} />
        <BoundingBoxVisualizer boards={boards} groups={groups} selectedItemIds={selectedItemIds} showBoundingBox={showBoundingBox} theme={theme} />
        <MeasurementOverlay boards={boards} selectedItemIds={selectedItemIds} showMeasurements={showMeasurements} measurements={measurements} units={units} theme={theme} />
        <MeasureSnapPreview boards={boards} measureMode={measureMode} />
        <PivotSnapPreview />
      </Canvas>
    </div>
  );
}
