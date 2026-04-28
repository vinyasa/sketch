import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, OrthographicCamera, OrbitControls, useTexture, useGLTF, GizmoHelper, Text, Billboard, Edges, Line, Html } from '@react-three/drei';
import { CustomGizmoViewport } from './CustomGizmoViewport';
import * as THREE from 'three';
import useStore from '../store/useStore';
import { computeWorldAABB, collectChildBoards, calculateGroupAABB } from '../utils/sceneGraph';
import { formatUnit } from '../utils/units';
import { WOOD_CATALOGUE, WOOD_TEXTURE_URLS, normalizeMaterial } from '../utils/materialCatalogue';
import { buildTaperGeometry, normalizeTaper } from '../utils/geometryBuilders';
import { computeHardwareTransform } from '../utils/hardwareCatalogue';
import { Evaluator, SUBTRACTION, INTERSECTION, Brush } from 'three-bvh-csg';

// CSG Evaluator instance
const csgEvaluator = new Evaluator();


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

// ── Snap point computation for Measure Mode ─────────────────────────────────
// Returns all snap-able points for a board in world space.
const computeSnapPoints = (board) => {
  const hx = board.size[0] / 2, hy = board.size[1] / 2, hz = board.size[2] / 2;
  const euler = new THREE.Euler(...(board.orientation || [0, 0, 0]), 'YXZ');
  const pivot = board.pivot || [0, 0, 0];

  const toWorld = (lx, ly, lz) => {
    const pt = new THREE.Vector3(lx - pivot[0], ly - pivot[1], lz - pivot[2]);
    pt.applyEuler(euler);
    return [pt.x + board.position[0], pt.y + board.position[1], pt.z + board.position[2]];
  };

  const points = [];
  // 8 corners
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    points.push({ localOffset: [sx*hx, sy*hy, sz*hz], worldPos: toWorld(sx*hx, sy*hy, sz*hz), type: 'corner' });
  }
  // 12 edge midpoints
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    points.push({ localOffset: [sx*hx, sy*hy, 0], worldPos: toWorld(sx*hx, sy*hy, 0), type: 'edge' });
    points.push({ localOffset: [sx*hx, 0, sy*hz], worldPos: toWorld(sx*hx, 0, sy*hz), type: 'edge' });
    points.push({ localOffset: [0, sx*hy, sy*hz], worldPos: toWorld(0, sx*hy, sy*hz), type: 'edge' });
  }
  // 6 face centers
  points.push({ localOffset: [hx, 0, 0], worldPos: toWorld(hx, 0, 0), type: 'face' });
  points.push({ localOffset: [-hx, 0, 0], worldPos: toWorld(-hx, 0, 0), type: 'face' });
  points.push({ localOffset: [0, hy, 0], worldPos: toWorld(0, hy, 0), type: 'face' });
  points.push({ localOffset: [0, -hy, 0], worldPos: toWorld(0, -hy, 0), type: 'face' });
  points.push({ localOffset: [0, 0, hz], worldPos: toWorld(0, 0, hz), type: 'face' });
  points.push({ localOffset: [0, 0, -hz], worldPos: toWorld(0, 0, -hz), type: 'face' });

  return points;
};

const findNearestSnap = (worldPoint, board) => {
  const snapPoints = computeSnapPoints(board);
  let best = null, bestDist = Infinity;
  const thresholds = { corner: 2.0, edge: 1.5, face: 1.0 };
  for (const sp of snapPoints) {
    const d = Math.sqrt(
      (sp.worldPos[0] - worldPoint[0]) ** 2 +
      (sp.worldPos[1] - worldPoint[1]) ** 2 +
      (sp.worldPos[2] - worldPoint[2]) ** 2
    );
    const thresh = thresholds[sp.type] || 1.0;
    if (d < thresh && d < bestDist) { best = sp; bestDist = d; }
  }
  return best;
};

// ── Custom Pivot Snapping Preview ───────────────────────────────────────────
function PivotSnapPreview() {
  const pivotHoverSnap = useStore(s => s.pivotHoverSnap);
  if (!pivotHoverSnap) return null;
  return (
    <mesh position={pivotHoverSnap} raycast={() => null}>
      <sphereGeometry args={[0.3, 16, 16]} />
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
              {isCorner ? <boxGeometry args={[0.45, 0.45, 0.45]} /> : <sphereGeometry args={[isEdge ? 0.3 : 0.2, 12, 12]} />}
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
              <sphereGeometry args={[0.35, 16, 16]} />
              <meshBasicMaterial color="#ff9f0a" depthTest={false} transparent opacity={0.9} />
            </mesh>
            <mesh position={worldPos} renderOrder={9} raycast={() => null}>
              <ringGeometry args={[0.5, 0.7, 24]} />
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

const _buildArcTool = (size, op) => {
  const { startAngle = 0, endAngle = 90, innerRadius = 0, axis = 'y' } = op;
  const axisIdx = axis === 'x' ? 0 : axis === 'z' ? 2 : 1;
  const thickness = size[axisIdx];
  
  let dimX, dimY;
  if (axis === 'y') { dimX = size[0]; dimY = size[2]; }
  else if (axis === 'x') { dimX = size[2]; dimY = size[1]; }
  else { dimX = size[0]; dimY = size[1]; }

  const shape = new THREE.Shape();
  const startRad = THREE.MathUtils.degToRad(startAngle);
  const endRad = THREE.MathUtils.degToRad(endAngle);
  
  shape.absellipse(0, 0, dimX, dimY, startRad, endRad, false, 0);
  if (innerRadius === 0) shape.lineTo(0, 0);
  else {
    const irX = Math.max(0.01, dimX - innerRadius);
    const irY = Math.max(0.01, dimY - innerRadius);
    shape.lineTo(Math.cos(endRad) * irX, Math.sin(endRad) * irY);
    shape.absellipse(0, 0, irX, irY, endRad, startRad, true, 0);
  }
  
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 12 });
  g.computeBoundingBox();
  const center = new THREE.Vector3();
  g.boundingBox.getCenter(center);
  g.translate(-center.x, -center.y, -center.z);
  
  if (axis === 'y') g.rotateX(-Math.PI / 2);
  if (axis === 'x') g.rotateY(Math.PI / 2);
  
  g.computeBoundingBox();
  const bboxSize = new THREE.Vector3();
  g.boundingBox.getSize(bboxSize);
  g.scale(size[0] / (bboxSize.x || 1), size[1] / (bboxSize.y || 1), size[2] / (bboxSize.z || 1));
  return g;
};

const _buildCoveTool = (size, op) => {
  const { edge = 'top', depth = 2, axis = 'y' } = op;
  const axisIdx = axis === 'x' ? 0 : axis === 'z' ? 2 : 1;
  const thickness = size[axisIdx];
  let dimX, dimY;
  if (axis === 'y') { dimX = size[0]; dimY = size[2]; }
  else if (axis === 'x') { dimX = size[2]; dimY = size[1]; }
  else { dimX = size[0]; dimY = size[1]; }

  const shape = new THREE.Shape();
  if (edge === 'bottom') { shape.moveTo(0, 0); shape.absellipse(dimX / 2, 0, dimX / 2, depth, Math.PI, 0, true, 0); } else { shape.moveTo(0, 0); shape.lineTo(dimX, 0); }
  if (edge === 'right') { shape.absellipse(dimX, dimY / 2, depth, dimY / 2, -Math.PI / 2, Math.PI / 2, true, 0); } else { shape.lineTo(dimX, dimY); }
  if (edge === 'top') { shape.absellipse(dimX / 2, dimY, dimX / 2, depth, 0, Math.PI, true, 0); } else { shape.lineTo(0, dimY); }
  if (edge === 'left') { shape.absellipse(0, dimY / 2, depth, dimY / 2, Math.PI / 2, -Math.PI / 2, true, 0); } else { shape.lineTo(0, 0); }

  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 12 });
  g.translate(-dimX/2, -dimY/2, -thickness/2);
  if (axis === 'y') g.rotateX(-Math.PI / 2);
  if (axis === 'x') g.rotateY(Math.PI / 2);
  
  g.computeBoundingBox();
  const bboxSize = new THREE.Vector3();
  g.boundingBox.getSize(bboxSize);
  g.scale(size[0] / (bboxSize.x || 1), size[1] / (bboxSize.y || 1), size[2] / (bboxSize.z || 1));
  return g;
};

// ── Dado / Groove / Rabbet tool builder ──────────────────────────────────────
const _FACE_MAP = {
  top:    { depthAxis: 1, sign: +1, faceAxes: [0, 2] },
  bottom: { depthAxis: 1, sign: -1, faceAxes: [0, 2] },
  front:  { depthAxis: 2, sign: +1, faceAxes: [0, 1] },
  back:   { depthAxis: 2, sign: -1, faceAxes: [0, 1] },
  right:  { depthAxis: 0, sign: +1, faceAxes: [1, 2] },
  left:   { depthAxis: 0, sign: -1, faceAxes: [1, 2] },
};
const _AXIS_LABELS = ['x', 'y', 'z'];

const _buildDadoTool = (size, op) => {
  const face = _FACE_MAP[op.face || 'top'];
  const { depthAxis, sign, faceAxes } = face;

  const depth = Math.max(0.01, op.depth ?? 0.375);
  const width = Math.max(0.01, op.width ?? 0.75);
  const offset = op.offset ?? 0;
  const lengthOffset = op.lengthOffset ?? 0;

  // Direction: which face-plane axis the channel runs along
  const dirAxis = op.direction === _AXIS_LABELS[faceAxes[1]] ? faceAxes[1] : faceAxes[0];
  const widthAxis = dirAxis === faceAxes[0] ? faceAxes[1] : faceAxes[0];

  // Channel length: 0 or missing = full through-cut
  const channelLength = (op.length ?? 0) <= 0 ? size[dirAxis] + 2 : op.length;

  // Build box dimensions
  const boxSize = [0, 0, 0];
  boxSize[dirAxis] = channelLength;
  boxSize[widthAxis] = width;
  boxSize[depthAxis] = depth;

  // Position: flush against the chosen face
  const pos = [0, 0, 0];
  pos[depthAxis] = sign * (size[depthAxis] / 2 - depth / 2);
  pos[widthAxis] = offset;
  pos[dirAxis] = lengthOffset;

  const geo = new THREE.BoxGeometry(boxSize[0], boxSize[1], boxSize[2]);
  geo.translate(pos[0], pos[1], pos[2]);
  return geo;
};

// ── Miter Saw Cut tool builder ───────────────────────────────────────────────
// The miter operation stores:
//   face      — which end to cut ('x+', 'x-', 'z+', 'z-')
//   fenceEdge — which edge of that end face the saw pivots from ('z-', 'z+', 'x-', 'x+')
//   angle     — miter degrees from square (always positive, 0–60°)
//   bevel     — bevel degrees (blade tilt from vertical, 0–45°)
//
// The fence edge stays at the measured length; the opposite edge gets shorter.
// Both face and fenceEdge are LOCAL to the board and never remapped.
//
// Compound miter: miter swings the blade around Y (turntable),
// bevel tilts the blade from vertical (motor head tilt).
const _buildMiterTool = (size, op) => {
  const face = op.face || 'x+';
  const fence = op.fenceEdge || 'z-';
  const angleDeg = Math.max(0, op.angle ?? 45);
  const angleRad = (angleDeg * Math.PI) / 180;
  const bevelDeg = op.bevel ?? 0;
  const bevelRad = (bevelDeg * Math.PI) / 180;

  const faceAxis = face[0] === 'x' ? 0 : face[0] === 'y' ? 1 : 2;
  const faceSign = face[1] === '+' ? 1 : -1;
  const fenceAxis = fence[0] === 'x' ? 0 : fence[0] === 'y' ? 1 : 2;
  const fenceSign = fence[1] === '+' ? 1 : -1;

  const cutterSize = Math.max(size[0], size[1], size[2]) * 4;
  const geo = new THREE.BoxGeometry(cutterSize, cutterSize, cutterSize);

  // 1. Position cutter so its cutting face is at the origin
  const shift = [0, 0, 0];
  shift[faceAxis] = faceSign * cutterSize / 2;
  const shiftToOrigin = new THREE.Matrix4().makeTranslation(shift[0], shift[1], shift[2]);

  // 2. Bevel rotation
  let bevelMatrix = new THREE.Matrix4();
  const thicknessAxis = [0, 1, 2].find(i => i !== faceAxis && i !== fenceAxis);
  
  if (Math.abs(bevelRad) > 0.001) {
    const pivotVal = bevelDeg > 0 ? -size[thicknessAxis] / 2 : size[thicknessAxis] / 2;
    
    const tv = [0, 0, 0];
    tv[thicknessAxis] = -pivotVal;
    const toOrigin = new THREE.Matrix4().makeTranslation(tv[0], tv[1], tv[2]);
    tv[thicknessAxis] = pivotVal;
    const fromOrigin = new THREE.Matrix4().makeTranslation(tv[0], tv[1], tv[2]);
    
    let rot = new THREE.Matrix4();
    
    // The rotation angle must tilt the face normal towards the thickness axis.
    // Based on right-hand rule rotations in Three.js (X->Y->Z->X cycle):
    // "Forward" face axis in cycle uses positive sin, "Backward" face axis uses negative sin.
    const isForward = 
      (fenceAxis === 0 && faceAxis === 1) || 
      (fenceAxis === 1 && faceAxis === 2) || 
      (fenceAxis === 2 && faceAxis === 0);
      
    const rotAngle = (isForward ? 1 : -1) * faceSign * bevelRad;
    
    if (fenceAxis === 0) rot.makeRotationX(rotAngle);
    else if (fenceAxis === 1) rot.makeRotationY(rotAngle);
    else rot.makeRotationZ(rotAngle);
    
    bevelMatrix.multiply(fromOrigin).multiply(rot).multiply(toOrigin);
  }

  // 3. Miter rotation
  let miterMatrix = new THREE.Matrix4();
  if (Math.abs(angleRad) > 0.001) {
    const rotAngle = faceSign * fenceSign * angleRad;
    if (thicknessAxis === 0) miterMatrix.makeRotationX((faceAxis === 1 ? -1 : 1) * rotAngle);
    else if (thicknessAxis === 1) miterMatrix.makeRotationY((faceAxis === 2 ? -1 : 1) * rotAngle);
    else miterMatrix.makeRotationZ((faceAxis === 0 ? -1 : 1) * rotAngle);
  }

  // 4. Translate to pivot
  const pivot = [0, 0, 0];
  pivot[faceAxis] = faceSign * size[faceAxis] / 2;
  pivot[fenceAxis] = fenceSign * size[fenceAxis] / 2;
  const shiftToPivot = new THREE.Matrix4().makeTranslation(pivot[0], pivot[1], pivot[2]);

  // Transform chain (right-to-left)
  const m = new THREE.Matrix4();
  m.multiply(shiftToPivot).multiply(miterMatrix).multiply(bevelMatrix).multiply(shiftToOrigin);
  geo.applyMatrix4(m);
  return geo;
};

const CSGGeometry = ({ b }) => {
  // Serialize only the fields that actually affect geometry.
  const targetKey = JSON.stringify({
    shape: b.shape,
    size: b.size,
    taper: b.taper,
    cylinder: b.cylinder,
    operations: b.operations,
  });

  const geo = useMemo(() => {
    const MAX_TRIS = 250000; // Safety limit — real hangs happen at millions, 250K is fine for modern GPUs
    let baseGeo;
    try {
      if (b.shape === 'taper') {
        const { angleLeft, angleRight, angleFront, angleBack } = normalizeTaper(b.taper);
        baseGeo = buildTaperGeometry(b.size[0], b.size[1], b.size[2], angleLeft, angleRight, angleFront, angleBack);
      } else if (b.shape === 'cylinder') {
        const axis = b.cylinder?.axis || 'y';
        const axisIdx = axis === 'x' ? 0 : axis === 'z' ? 2 : 1;
        const dim1 = b.size[(axisIdx + 1) % 3];
        const dim2 = b.size[(axisIdx + 2) % 3];
        const radius = Math.min(dim1, dim2) / 2;
        const height = b.size[axisIdx];
        baseGeo = new THREE.CylinderGeometry(radius, radius, height, 64, 1);
        if (axis === 'x') baseGeo.rotateZ(Math.PI / 2);
        if (axis === 'z') baseGeo.rotateX(Math.PI / 2);
      } else {
        baseGeo = new THREE.BoxGeometry(b.size[0], b.size[1], b.size[2]);
      }

      if (!b.operations || b.operations.length === 0) return baseGeo;

      // Helper: count triangles in a geometry/brush
      const triCount = (brush) => {
        const g = brush.geometry || brush;
        if (g.index) return g.index.count / 3;
        const pos = g.getAttribute?.('position');
        return pos ? pos.count / 3 : 0;
      };

      // ── CSG strategy ────────────────────────────────────────────────────────
      const activeOps = b.operations.filter(op => op.enabled !== false);
      if (activeOps.length === 0) return baseGeo;

      const subOps    = activeOps.filter(op => op.type === 'hole' || op.type === 'dado' || op.type === 'miter' || op.type === 'subtract');
      const intersOps = activeOps.filter(op => op.type === 'arc' || op.type === 'cove');

      let resultBrush = new Brush(baseGeo);
      resultBrush.updateMatrixWorld();

      // ── 1. Subtractions (holes) ────────────────────────────────────────────
      for (const op of subOps) {
        try {
          let opBrush;
          if (op.type === 'subtract') {
            // ── Boolean subtract: rebuild cutter from snapshot ──────────
            const cs = op.cutterSize;
            let cutterGeo;
            if (op.cutterShape === 'cylinder') {
              const cAxis = op.cutterCylinder?.axis || 'y';
              const cAxisIdx = cAxis === 'x' ? 0 : cAxis === 'z' ? 2 : 1;
              const cDim1 = cs[(cAxisIdx + 1) % 3];
              const cDim2 = cs[(cAxisIdx + 2) % 3];
              const cRadius = Math.min(cDim1, cDim2) / 2;
              const cHeight = cs[cAxisIdx];
              cutterGeo = new THREE.CylinderGeometry(cRadius, cRadius, cHeight, 64, 1);
              if (cAxis === 'x') cutterGeo.rotateZ(Math.PI / 2);
              if (cAxis === 'z') cutterGeo.rotateX(Math.PI / 2);
            } else if (op.cutterShape === 'taper' && op.cutterTaper) {
              const { angleLeft, angleRight, angleFront, angleBack } = normalizeTaper(op.cutterTaper);
              cutterGeo = buildTaperGeometry(cs[0], cs[1], cs[2], angleLeft, angleRight, angleFront, angleBack);
            } else {
              cutterGeo = new THREE.BoxGeometry(cs[0], cs[1], cs[2]);
            }
            // Apply the stored relative transform (positions cutter in target's local space)
            if (op.relativeMatrix) {
              const m = new THREE.Matrix4().fromArray(op.relativeMatrix);
              cutterGeo.applyMatrix4(m);
            }
            opBrush = new Brush(cutterGeo);
            opBrush.updateMatrixWorld();
          } else if (op.type === 'miter') {
            opBrush = new Brush(_buildMiterTool(b.size, op));
            opBrush.updateMatrixWorld();
          } else if (op.type === 'dado') {
            opBrush = new Brush(_buildDadoTool(b.size, op));
            opBrush.updateMatrixWorld();
          } else {
            // Hole
            const axis = op.axis || 'y';
            const r = Math.max(0.01, op.radius || 1);
            const hLength = Math.max(...b.size) + 10;
            const cyl = new THREE.CylinderGeometry(r, r, hLength, 32);
            opBrush = new Brush(cyl);
            if (axis === 'x') opBrush.rotation.z = Math.PI / 2;
            else if (axis === 'z') opBrush.rotation.x = Math.PI / 2;
            const ox = op.offsetX || 0;
            const oy = op.offsetY || 0;
            if (axis === 'z') opBrush.position.set(ox, oy, 0);
            else if (axis === 'x') opBrush.position.set(0, oy, ox);
            else opBrush.position.set(ox, 0, oy);
            opBrush.updateMatrixWorld();
          }

          const prevGeometry = resultBrush.geometry;
          resultBrush = csgEvaluator.evaluate(resultBrush, opBrush, SUBTRACTION);
          resultBrush.updateMatrixWorld();
          if (prevGeometry !== baseGeo) prevGeometry?.dispose();
          opBrush.geometry?.dispose();

          // Safety check
          if (triCount(resultBrush) > MAX_TRIS) {
            console.warn(`[CSG] Triangle limit exceeded after hole op on "${b.name}" (${triCount(resultBrush)} tris). Falling back.`);
            return new THREE.BoxGeometry(b.size[0], b.size[1], b.size[2]);
          }
        } catch (e) {
          console.error('CSG hole error:', e);
        }
      }

      // ── 2. Intersections (arc / cove) — hybrid strategy ───────────────────
      //   • Same-axis ops are merged into one tool first (cheap — tools
      //     overlap cleanly on the same plane).
      //   • Then each axis group is applied sequentially to the base mesh.
      //     Each pass carves material away, keeping the mesh manageable
      //     for multi-axis cuts.
      if (intersOps.length > 0) {
        const buildTool = (op) => {
          if (op.type === 'arc')  return new Brush(_buildArcTool(b.size, op));
          if (op.type === 'cove') return new Brush(_buildCoveTool(b.size, op));
          return null;
        };

        // Group operations by axis
        const byAxis = {};
        for (const op of intersOps) {
          const a = op.axis || 'y';
          (byAxis[a] ??= []).push(op);
        }

        // Process each axis group
        for (const [axisKey, ops] of Object.entries(byAxis)) {
          try {
            // Build first tool for this axis
            let axisTool = buildTool(ops[0]);
            if (!axisTool) continue;
            axisTool.updateMatrixWorld();

            // Merge additional same-axis tools (cheap — same-plane overlap)
            for (let i = 1; i < ops.length; i++) {
              const nextTool = buildTool(ops[i]);
              if (!nextTool) continue;
              nextTool.updateMatrixWorld();
              const prevGeo = axisTool.geometry;
              axisTool = csgEvaluator.evaluate(axisTool, nextTool, INTERSECTION);
              axisTool.updateMatrixWorld();
              prevGeo?.dispose();
              nextTool.geometry?.dispose();
            }

            // Apply merged axis tool to the running result
            const prevGeometry = resultBrush.geometry;
            resultBrush = csgEvaluator.evaluate(resultBrush, axisTool, INTERSECTION);
            resultBrush.updateMatrixWorld();
            if (prevGeometry !== baseGeo) prevGeometry?.dispose();
            axisTool.geometry?.dispose();

            const tris = triCount(resultBrush);
            if (tris > MAX_TRIS) {
              console.warn(`[CSG] Triangle limit exceeded after ${axisKey}-axis ops on "${b.name}" (${tris} tris). Falling back.`);
              return new THREE.BoxGeometry(b.size[0], b.size[1], b.size[2]);
            }
          } catch (e) {
            console.error(`CSG ${axisKey}-axis error on "${b.name}":`, e);
          }
        }
      }

      return resultBrush.geometry;
    } catch (e) {
      console.error('CSG base error:', e);
      // Fall back to plain box so the board is still visible
      return new THREE.BoxGeometry(b.size[0], b.size[1], b.size[2]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);


  return <primitive object={geo} attach="geometry" />;
};

const getSemanticFace = (e, b) => {
  const hasBoxFaces = !b.shape || b.shape === 'taper';
  if (hasBoxFaces && e.faceIndex !== undefined) {
    return ['x+', 'x-', 'y+', 'y-', 'z+', 'z-'][Math.floor(e.faceIndex / 2)];
  }
  // For curved geometries (cylinder/disc), convert click to local space
  // and find closest AABB plane.
  if (e.point && e.object) {
    const localPt = e.object.worldToLocal(e.point.clone());
    const hw = b.size[0] / 2;
    const hh = b.size[1] / 2;
    const hd = b.size[2] / 2;
    const dists = {
      'x+': Math.abs(hw - localPt.x),
      'x-': Math.abs(-hw - localPt.x),
      'y+': Math.abs(hh - localPt.y),
      'y-': Math.abs(-hh - localPt.y),
      'z+': Math.abs(hd - localPt.z),
      'z-': Math.abs(-hd - localPt.z),
    };
    let bestFace = null;
    let minDist = Infinity;
    for (const [face, d] of Object.entries(dists)) {
      if (d < minDist) {
        minDist = d;
        bestFace = face;
      }
    }
    return bestFace;
  }
  return null;
};

// ── Convert a local face string to its world-facing direction ────────────
// Used when storing constraint faces so the solver (which works in world
// space) snaps on the correct axis.  For unoriented boards this is identity.
const localFaceToWorld = (localFace, orientation) => {
  if (!localFace) return localFace;
  const [rx, ry, rz] = orientation || [0, 0, 0];
  if (rx === 0 && ry === 0 && rz === 0) return localFace;

  const axisIdx = localFace[0] === 'x' ? 0 : localFace[0] === 'y' ? 1 : 2;
  const sign = localFace[1] === '+' ? 1 : -1;
  const localN = [0, 0, 0];
  localN[axisIdx] = sign;

  // Three.js YXZ Euler order: a=cos(x),b=sin(x),c=cos(y),d=sin(y),e=cos(z),f=sin(z)
  const a = Math.cos(rx), b = Math.sin(rx);
  const c = Math.cos(ry), d = Math.sin(ry);
  const e = Math.cos(rz), f = Math.sin(rz);
  const ce = c*e, cf = c*f, de = d*e, df = d*f;
  // Row-major rotation matrix (from Three.js makeRotationFromEuler YXZ)
  const R = [
    [ce+df*b,  de*b-cf,  a*d ],
    [a*f,      a*e,     -b   ],
    [cf*b-de,  df+ce*b,  a*c ],
  ];
  const worldN = [
    R[0][0] * localN[0] + R[0][1] * localN[1] + R[0][2] * localN[2],
    R[1][0] * localN[0] + R[1][1] * localN[1] + R[1][2] * localN[2],
    R[2][0] * localN[0] + R[2][1] * localN[1] + R[2][2] * localN[2],
  ];

  let bestAxis = 0, bestAbs = 0;
  for (let i = 0; i < 3; i++) {
    const a2 = Math.abs(worldN[i]);
    if (a2 > bestAbs) { bestAbs = a2; bestAxis = i; }
  }
  return ['x', 'y', 'z'][bestAxis] + (worldN[bestAxis] > 0 ? '+' : '-');
};

// ── Hardware attachment renderer ─────────────────────────────────────────────
const HardwareAttachment = ({ hw, boardSize, boardId }) => {
  const { selectedHardwareId, setSelectedHardwareId, setSelectedItemIds, updateHardware } = useStore();
  const { scene } = useGLTF(hw.modelUrl);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  const { position, rotation } = computeHardwareTransform(boardSize, hw.face, hw.offset);
  const isSelected = selectedHardwareId === hw.id;

  // Auto-scale on first load: if scale is still 1 and model is very small/large relative to board,
  // compute a sensible default. Models from Sketchfab are typically in meters, boards are in inches.
  useEffect(() => {
    if (hw.scale && hw.scale !== 1) return; // user already set a custom scale
    const box = new THREE.Box3().setFromObject(clonedScene);
    const modelSize = new THREE.Vector3();
    box.getSize(modelSize);
    const maxModelDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
    if (maxModelDim <= 0) return;

    // Target: hardware should be roughly 1/3 the board's smallest face dimension
    const targetSize = Math.min(...boardSize) * 0.8;
    const autoScale = targetSize / maxModelDim;

    // Only auto-adjust if the ratio is very off (model is >5x too big or too small)
    if (autoScale < 0.2 || autoScale > 5) {
      const rounded = parseFloat(autoScale.toFixed(2));
      updateHardware(boardId, hw.id, { scale: rounded });
    }
  }, [clonedScene]); // only on first load

  // Combine face rotation with user-specified rotation
  const finalRotation = [
    rotation[0] + (hw.rotation?.[0] || 0),
    rotation[1] + (hw.rotation?.[1] || 0),
    rotation[2] + (hw.rotation?.[2] || 0),
  ];

  // Apply emissive highlight when selected
  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child.isMesh && child.material) {
        const mat = child.material.clone();
        mat.emissive = new THREE.Color(isSelected ? '#bc8a5f' : '#000000');
        mat.emissiveIntensity = isSelected ? 0.6 : 0;
        child.material = mat;
      }
    });
  }, [clonedScene, isSelected]);

  return (
    <group
      position={position}
      rotation={finalRotation}
      scale={hw.scale || 1}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedItemIds([boardId.toString()]);
        setSelectedHardwareId(hw.id);
      }}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}
    >
      <primitive object={clonedScene} />
    </group>
  );
};

const BoardMesh = ({ b, selectedItemIds, toggleSelection, textures, showEdges, constraintTargetMode, hoveredFaceData, setHoveredFaceData, modifierActive }) => {
  if (b.visible === false) return null;
  const isSelected = selectedItemIds.includes(b.id.toString());

  // Pivot offset in LOCAL board space (default [0,0,0] = center)
  const pivot = b.pivot || [0, 0, 0];
  const hasPivot = pivot[0] !== 0 || pivot[1] !== 0 || pivot[2] !== 0;

  // Face labels are in LOCAL board space — orientation is handled by the mesh transform
  const faceLabels = {
    'x+': 'right', 'x-': 'left',
    'y+': 'top',   'y-': 'bottom',
    'z+': 'front', 'z-': 'back'
  };

  return (
    <group
      position={b.position}
      rotation={b.orientation ? [...b.orientation, 'YXZ'] : [0, 0, 0, 'YXZ']}
    >
      {/* Inner mesh is offset by -pivot so the board geometry rotates around the pivot */}
      <mesh
        position={[-pivot[0], -pivot[1], -pivot[2]]}
        raycast={(modifierActive && constraintTargetMode?.active) ? () => null : undefined}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();

          // ── Pivot Mode ──
          const { pivotMode, setPivotMode, gridSnap, setCustomPivot, setPivotHoverSnap } = useStore.getState();
          if (pivotMode?.active && pivotMode.boardId === b.id.toString()) {
            const gridStep = gridSnap === '1/8 in' ? 0.125 : gridSnap === '1/4 in' ? 0.25 : gridSnap === '1/2 in' ? 0.5 : gridSnap === '1 in' ? 1.0 : 0.125;
            const pt = e.point.clone();
            const euler = new THREE.Euler(...(b.orientation || [0, 0, 0]), 'YXZ');
            pt.sub(new THREE.Vector3(...b.position));
            pt.applyEuler(new THREE.Euler(-euler.x, -euler.y, -euler.z, 'ZXY'));

            const snx = Math.round(pt.x / gridStep) * gridStep;
            const sny = Math.round(pt.y / gridStep) * gridStep;
            const snz = Math.round(pt.z / gridStep) * gridStep;

            setCustomPivot(b.id, [snx, sny, snz]);
            setPivotMode(null);
            setPivotHoverSnap(null);
            useStore.getState().showToast('Pivot point set successfully.');
            return;
          }

          // ── Measure Mode: first point only ──
          const { measureMode, setMeasureMode } = useStore.getState();
          if (measureMode?.active) {
            if (!measureMode.firstPoint) {
              const hitWorld = [e.point.x, e.point.y, e.point.z];
              const snap = findNearestSnap(hitWorld, b);
              const point = snap
                ? { localOffset: snap.localOffset, boardId: b.id.toString(), snapType: snap.type }
                : { localOffset: [e.point.x - b.position[0], e.point.y - b.position[1], e.point.z - b.position[2]], boardId: b.id.toString(), snapType: 'surface' };
              setMeasureMode({ active: true, firstPoint: point });
            }
            // Second point is handled by onPointerDown (drag mode)
            return;
          }

          const localFace = getSemanticFace(e, b);
          const faceStr = localFaceToWorld(localFace, b.orientation);
          toggleSelection(b.id.toString(), e.shiftKey || e.ctrlKey || e.metaKey, faceStr);
        }}
        onPointerDown={(e) => {
          // ── Measure Mode: second point starts drag ──
          const { measureMode, setMeasureMode } = useStore.getState();
          if (measureMode?.active && measureMode.firstPoint && !measureMode.dragging) {
            e.stopPropagation();
            const hitWorld = [e.point.x, e.point.y, e.point.z];
            const snap = findNearestSnap(hitWorld, b);
            const point = snap
              ? { localOffset: snap.localOffset, boardId: b.id.toString(), snapType: snap.type }
              : { localOffset: [e.point.x - b.position[0], e.point.y - b.position[1], e.point.z - b.position[2]], boardId: b.id.toString(), snapType: 'surface' };

            // Prevent zero-length
            const fp = measureMode.firstPoint;
            if (fp.boardId === point.boardId &&
                Math.abs(fp.localOffset[0] - point.localOffset[0]) < 0.1 &&
                Math.abs(fp.localOffset[1] - point.localOffset[1]) < 0.1 &&
                Math.abs(fp.localOffset[2] - point.localOffset[2]) < 0.1) {
              setMeasureMode({ active: true, firstPoint: null });
              return;
            }

            // Compute offset direction: perpendicular to measurement line
            // Use camera forward crossed with measurement direction for a natural perpendicular
            const fpBoard = useStore.getState().boards.find(x => x.id.toString() === fp.boardId);
            if (!fpBoard) return;
            const euler1 = new THREE.Euler(...(fpBoard.orientation || [0, 0, 0]), 'YXZ');
            const pivot1 = fpBoard.pivot || [0, 0, 0];
            const pt1 = new THREE.Vector3(fp.localOffset[0]-pivot1[0], fp.localOffset[1]-pivot1[1], fp.localOffset[2]-pivot1[2]);
            pt1.applyEuler(euler1);
            const wA = new THREE.Vector3(pt1.x+fpBoard.position[0], pt1.y+fpBoard.position[1], pt1.z+fpBoard.position[2]);

            const euler2 = new THREE.Euler(...(b.orientation || [0, 0, 0]), 'YXZ');
            const pivot2 = b.pivot || [0, 0, 0];
            const pt2 = new THREE.Vector3(point.localOffset[0]-pivot2[0], point.localOffset[1]-pivot2[1], point.localOffset[2]-pivot2[2]);
            pt2.applyEuler(euler2);
            const wB = new THREE.Vector3(pt2.x+b.position[0], pt2.y+b.position[1], pt2.z+b.position[2]);

            const measDir = new THREE.Vector3().subVectors(wB, wA).normalize();
            // OffsetDirA: world-axis perpendicular (default drag direction)
            let offsetDirA;
            if (Math.abs(measDir.y) > 0.9) {
              offsetDirA = Math.abs(measDir.x) < Math.abs(measDir.z)
                ? new THREE.Vector3(1, 0, 0)
                : new THREE.Vector3(0, 0, 1);
            } else {
              offsetDirA = new THREE.Vector3(0, 1, 0);
            }

            // OffsetDirB: face normal of the clicked board (perpendicular to face)
            let offsetDirB = new THREE.Vector3(0, 1, 0); // fallback
            if (e.face && e.face.normal) {
              // Transform local face normal to world space using the board's rotation
              offsetDirB = e.face.normal.clone().applyEuler(euler2).normalize();
            }
            // Ensure it's not parallel to the measurement direction
            if (Math.abs(offsetDirB.dot(measDir)) > 0.95) {
              offsetDirB = offsetDirA.clone(); // fallback to axis perpendicular
            }

            setMeasureMode({
              active: true,
              firstPoint: measureMode.firstPoint,
              secondPoint: point,
              dragging: true,
              dragOffset: 0,
              offsetDir: [offsetDirA.x, offsetDirA.y, offsetDirA.z],
              offsetDirA: [offsetDirA.x, offsetDirA.y, offsetDirA.z],
              offsetDirB: [offsetDirB.x, offsetDirB.y, offsetDirB.z],
            });
          }
        }}
        onPointerMove={(e) => {
          // ── Pivot Mode hover snap tracking ──
          const { pivotMode, setPivotHoverSnap, gridSnap } = useStore.getState();
          if (pivotMode?.active && pivotMode.boardId === b.id.toString()) {
            e.stopPropagation();
            const gridStep = gridSnap === '1/8 in' ? 0.125 : gridSnap === '1/4 in' ? 0.25 : gridSnap === '1/2 in' ? 0.5 : gridSnap === '1 in' ? 1.0 : 0.125;
            const pt = e.point.clone();
            const euler = new THREE.Euler(...(b.orientation || [0, 0, 0]), 'YXZ');
            pt.sub(new THREE.Vector3(...b.position));
            pt.applyEuler(new THREE.Euler(-euler.x, -euler.y, -euler.z, 'ZXY'));

            const snx = Math.round(pt.x / gridStep) * gridStep;
            const sny = Math.round(pt.y / gridStep) * gridStep;
            const snz = Math.round(pt.z / gridStep) * gridStep;

            const worldPt = new THREE.Vector3(snx, sny, snz);
            worldPt.applyEuler(euler);
            worldPt.add(new THREE.Vector3(...b.position));

            setPivotHoverSnap([worldPt.x, worldPt.y, worldPt.z]);
            return;
          }

          // ── Hover snap tracking for measure mode ──
          const { measureMode: mm, setMeasureHoverSnap, measureHoverSnap } = useStore.getState();
          if (mm?.active && !mm.dragging) {
            e.stopPropagation();
            const hitWorld = [e.point.x, e.point.y, e.point.z];
            const snap = findNearestSnap(hitWorld, b);
            if (snap) {
              // Only update if different snap point
              if (!measureHoverSnap ||
                  measureHoverSnap.boardId !== b.id.toString() ||
                  measureHoverSnap.localOffset[0] !== snap.localOffset[0] ||
                  measureHoverSnap.localOffset[1] !== snap.localOffset[1] ||
                  measureHoverSnap.localOffset[2] !== snap.localOffset[2]) {
                setMeasureHoverSnap({ ...snap, boardId: b.id.toString() });
              }
            } else if (measureHoverSnap && measureHoverSnap.boardId === b.id.toString()) {
              setMeasureHoverSnap(null);
            }
          }

          const isActiveMode = constraintTargetMode && constraintTargetMode.active;
          if (isSelected || isActiveMode) {
            e.stopPropagation();
            const fStr = getSemanticFace(e, b);
            if (fStr && (!hoveredFaceData || hoveredFaceData.id !== b.id.toString() || hoveredFaceData.faceStr !== fStr)) {
              setHoveredFaceData({ id: b.id.toString(), faceStr: fStr });
            }
          }
        }}
        onPointerOut={(e) => {
          // Clear measure and pivot hover snap when leaving this board
          const { measureMode: mm, setMeasureHoverSnap, pivotMode, setPivotHoverSnap } = useStore.getState();
          if (mm?.active) setMeasureHoverSnap(null);
          if (pivotMode?.active) setPivotHoverSnap(null);
          if (hoveredFaceData && hoveredFaceData.id === b.id.toString()) {
            setHoveredFaceData(null);
          }
        }}
      >
        <CSGGeometry b={b} />
        {(() => {
          const matDesc = normalizeMaterial(b.material);
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
              color="#ffffff"
              map={textures[matDesc.id] ?? textures['pine']}
              roughness={spec.roughness}
              {...commonProps}
            />
          );
        })()}
        {showEdges && <Edges scale={1} threshold={15} color={isSelected ? '#ffffff' : '#222222'} />}
        {/* Axes helper on the mesh (at board center, not pivot) */}
        {isSelected && <axesHelper args={[Math.max(...b.size) * 0.75 + 2.25]} />}
        {((isSelected || (constraintTargetMode && constraintTargetMode.active)) && hoveredFaceData && hoveredFaceData.id === b.id.toString()) && (() => {
          const faceStr = hoveredFaceData.faceStr;
          if (!faceStr) return null;
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
        {/* ── Hardware attachments ─────────────────────────────────────────── */}
        {(b.hardware || []).length > 0 && (
          <Suspense fallback={null}>
            {(b.hardware || []).map(hw => (
              <HardwareAttachment key={hw.id} hw={hw} boardSize={b.size} boardId={b.id} />
            ))}
          </Suspense>
        )}
      </mesh>

      {/* ── Pivot Visualizer ───────────────────────────────────────────────── */}
      {/* Shown when board is selected and pivot is not at center.              */}
      {/* The pivot point is at the group origin (0,0,0); the board center     */}
      {/* is at (-pivot). We draw a sphere at origin and a dashed line to it.  */}
      {isSelected && hasPivot && (
        <group>
          {/* Pivot sphere — magenta, always visible */}
          <mesh raycast={() => null}>
            <sphereGeometry args={[0.35, 16, 16]} />
            <meshBasicMaterial color="#ff00ff" transparent opacity={0.85} depthTest={false} />
          </mesh>
          {/* Dashed line from pivot to board center */}
          <Line
            points={[[0, 0, 0], [-pivot[0], -pivot[1], -pivot[2]]]}
            color="#ff00ff"
            lineWidth={2}
            dashed
            dashScale={8}
            dashSize={1}
            dashOffset={0}
          />
          {/* Pivot label */}
          <Html center style={{ pointerEvents: 'none' }}>
            <div style={{
              background: 'rgba(180, 0, 180, 0.8)',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '10px',
              fontSize: '0.65rem',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              transform: 'translateY(-14px)',
            }}>
              ⊕ Pivot
            </div>
          </Html>
        </group>
      )}
    </group>
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

function WoodJoint({ boards, groups, selectedItemIds, toggleSelection, showEdges, showMeasurements, measurements, showBoundingBox, units, theme, constraintTargetMode, hoveredFaceData, setHoveredFaceData, modifierActive, constraints, measureMode }) {
  // WOOD_TEXTURE_URLS is a stable module-level object — safe to pass to useTexture()
  const textures = useTexture(WOOD_TEXTURE_URLS);

  Object.values(textures).forEach(t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  });

  const rootGroups = Object.keys(groups).filter(k => groups[k].parentId === null);
  const rootBoards = boards.filter(b => b.parentId === 'Workspace');

  // Orphaned boards: parentId references a group that doesn't exist in the groups map.
  // Render them as root-level boards so they're never invisible.
  const allGroupIds = new Set(Object.keys(groups));
  allGroupIds.add('Workspace');
  const orphanedBoards = boards.filter(b => !allGroupIds.has(b.parentId));

  return (
    <group>
      {rootGroups.map(k => (
        <RecursiveNode key={k} nodeId={k} groups={groups} boards={boards} selectedItemIds={selectedItemIds} toggleSelection={toggleSelection} textures={textures} showEdges={showEdges} constraintTargetMode={constraintTargetMode} hoveredFaceData={hoveredFaceData} setHoveredFaceData={setHoveredFaceData} modifierActive={modifierActive} />
      ))}
      {rootBoards.map(b => (
        <BoardMesh key={`root_${b.id}`} b={b} selectedItemIds={selectedItemIds} toggleSelection={toggleSelection} textures={textures} showEdges={showEdges} constraintTargetMode={constraintTargetMode} hoveredFaceData={hoveredFaceData} setHoveredFaceData={setHoveredFaceData} modifierActive={modifierActive} />
      ))}
      {orphanedBoards.map(b => (
        <BoardMesh key={`orphan_${b.id}`} b={b} selectedItemIds={selectedItemIds} toggleSelection={toggleSelection} textures={textures} showEdges={showEdges} constraintTargetMode={constraintTargetMode} hoveredFaceData={hoveredFaceData} setHoveredFaceData={setHoveredFaceData} modifierActive={modifierActive} />
      ))}
      <ConstraintVisualizer boards={boards} groups={groups} selectedItemIds={selectedItemIds} constraints={constraints} />
      <BoundingBoxVisualizer boards={boards} groups={groups} selectedItemIds={selectedItemIds} showBoundingBox={showBoundingBox} theme={theme} />
      <MeasurementOverlay boards={boards} selectedItemIds={selectedItemIds} showMeasurements={showMeasurements} measurements={measurements} units={units} theme={theme} />
      <MeasureSnapPreview boards={boards} measureMode={measureMode} />
      <PivotSnapPreview />
    </group>
  );
}

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

  const isDark = theme === 'dark';
  const majorColor = isDark ? 0x666666 : 0x999999;
  const minorColor = isDark ? 0x242424 : 0xd2d2d2;

  const workspaceSize = useStore(s => s.workspaceSize) || 120;
  const gridRadius = workspaceSize;
  let minorDivs = 0, majorDivs = Math.ceil(workspaceSize / 6);

  if (gridSnap === '1/16 in') {
    minorDivs = workspaceSize * 4;
    majorDivs = Math.ceil(workspaceSize / 1.5);
  } else if (gridSnap === '1/8 in') {
    minorDivs = workspaceSize * 2;
    majorDivs = Math.ceil(workspaceSize / 3);
  } else if (gridSnap === '1/4 in') {
    minorDivs = workspaceSize;
    majorDivs = Math.ceil(workspaceSize / 6);
  } else if (gridSnap === '1/2 in' || gridSnap === '1 in') {
    minorDivs = workspaceSize;
    majorDivs = Math.ceil(workspaceSize / 6);
  } else if (gridSnap === 'off') {
    minorDivs = 0;
    majorDivs = Math.ceil(workspaceSize / 6);
  }

  return (
    <div className="viewport-container" style={{ width: '100%', height: '100%', position: 'relative' }}>

      <Canvas shadows={lighting?.shadows ? 'soft' : false} onPointerMissed={() => setSelectedItemIds([])}>
        <SceneLights lighting={lighting} />
        {!printCapture && <ShadowFloor shadows={lighting?.shadows} />}

        {/* Gizmo: R=Right(+X), L=Left(-X), U=Up(+Y), D=Down(-Y), F=Front(+Z), B=Back(-Z) */}
        <GizmoHelper alignment="top-center" margin={[0, 160]}>
          <CustomGizmoViewport />
        </GizmoHelper>

        {isOrtho ? (
          <OrthographicCamera makeDefault position={_cameraPos} zoom={12} near={0.1} far={1000} />
        ) : (
          <PerspectiveCamera makeDefault position={_cameraPos} near={0.1} far={1000} />
        )}

        <PersistentControls />
        <AnimationDriver />
        <MeasureDragHandler />
        <PrintCaptureHandler />
        {/* Floor grid at Y=0 — hidden during print */}
        {showGrid && !printCapture && minorDivs > 0 && (
          <gridHelper key={`min_${minorDivs}_${theme}`} args={[gridRadius, minorDivs, minorColor, minorColor]} position={[0, -0.02, 0]} />
        )}
        {showGrid && !printCapture && <gridHelper key={`maj_${majorDivs}_${theme}`} args={[gridRadius, majorDivs, majorColor, majorColor]} position={[0, 0.02, 0]} />}
        {showGrid && !printCapture && (
          <axesHelper 
            args={[workspaceSize / 2]} 
            position={[0, 0.03, 0]} 
            onUpdate={(self) => {
              const xColor = isDark ? '#ff5555' : '#aa0000';
              const yColor = isDark ? '#55ff55' : '#00aa00';
              const zColor = isDark ? '#5555ff' : '#0000aa';
              self.setColors(xColor, yColor, zColor);
            }}
          />
        )}
        {showGrid && !printCapture && <FloorFrontLabel />}

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
          <WoodJoint
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
      </Canvas>
    </div>
  );
}
