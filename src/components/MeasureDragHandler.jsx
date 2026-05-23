import React, { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../store/useStore';

export function MeasureDragHandler() {
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
}
