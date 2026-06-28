import React from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../store/useStore';

export function AnimationDriver() {
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

      if (boardAnim.isGroup) {
        const startBoards = boardAnim.start.boards || [];
        const endBoards = boardAnim.end.boards || [];
        if (startBoards.length > 0 && endBoards.length > 0) {
          // 1. Calculate start and end centroids
          const startCentroid = new THREE.Vector3();
          startBoards.forEach(sb => {
            startCentroid.add(new THREE.Vector3(...sb.position));
          });
          startCentroid.divideScalar(startBoards.length);

          const endCentroid = new THREE.Vector3();
          endBoards.forEach(eb => {
            endCentroid.add(new THREE.Vector3(...eb.position));
          });
          endCentroid.divideScalar(endBoards.length);

          // Current centroid (lerped path for translation)
          const currentCentroid = new THREE.Vector3().lerpVectors(startCentroid, endCentroid, eased);

          // 2. Calculate relative rotation quaternion using the first board
          const sb0 = startBoards[0];
          const eb0 = endBoards.find(eb => eb.id === sb0.id);
          
          const qRel = new THREE.Quaternion();
          if (eb0) {
            const qStart0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(...sb0.orientation, 'YXZ'));
            const qEnd0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(...eb0.orientation, 'YXZ'));
            const qCurrent0 = qStart0.clone().slerp(qEnd0, eased);
            
            // qRel = qCurrent0 * qStart0^-1
            qRel.copy(qCurrent0).multiply(qStart0.clone().invert());
          }

          // Map end boards for quick lookup
          const endMap = {};
          endBoards.forEach(eb => {
            endMap[eb.id] = eb;
          });

          const animatedBoardsMap = {};
          startBoards.forEach(sb => {
            const eb = endMap[sb.id];
            if (!eb) return;

            // Initial position relative to start centroid
            const relPosStart = new THREE.Vector3(...sb.position).sub(startCentroid);
            // Rotate relative position around centroid pivot
            relPosStart.applyQuaternion(qRel);
            // Final position = current centroid + rotated relative position
            const currentPos = currentCentroid.clone().add(relPosStart);

            // Calculate current orientation
            const qStart = new THREE.Quaternion().setFromEuler(new THREE.Euler(...sb.orientation, 'YXZ'));
            const qCurrent = qRel.clone().multiply(qStart);
            const currentEuler = new THREE.Euler().setFromQuaternion(qCurrent, 'YXZ');

            // Lerp pivot
            const startPiv = sb.pivot || [0, 0, 0];
            const endPiv = eb.pivot || [0, 0, 0];
            const lerpedPiv = [
              startPiv[0] + (endPiv[0] - startPiv[0]) * eased,
              startPiv[1] + (endPiv[1] - startPiv[1]) * eased,
              startPiv[2] + (endPiv[2] - startPiv[2]) * eased,
            ];
            const hasPiv = lerpedPiv[0] !== 0 || lerpedPiv[1] !== 0 || lerpedPiv[2] !== 0;

            animatedBoardsMap[sb.id] = {
              position: [currentPos.x, currentPos.y, currentPos.z],
              orientation: [currentEuler.x, currentEuler.y, currentEuler.z],
              pivot: hasPiv ? lerpedPiv : undefined,
            };
          });

          // Apply to all children
          state.setBoards(prev => prev.map(b => {
            const anim = animatedBoardsMap[b.id.toString()];
            if (!anim) return b;
            return {
              ...b,
              position: anim.position,
              orientation: anim.orientation,
              pivot: anim.pivot,
            };
          }));
        }
      } else {
        // Lerp position if start and end have it
        const startPos = boardAnim.start.position;
        const endPos = boardAnim.end.position;
        const lerpedPos = startPos && endPos ? [
          startPos[0] + (endPos[0] - startPos[0]) * eased,
          startPos[1] + (endPos[1] - startPos[1]) * eased,
          startPos[2] + (endPos[2] - startPos[2]) * eased,
        ] : null;

        // Lerp orientation
        const startOri = boardAnim.start.orientation;
        const endOri = boardAnim.end.orientation;
        const lerpedOri = startOri && endOri ? [
          startOri[0] + (endOri[0] - startOri[0]) * eased,
          startOri[1] + (endOri[1] - startOri[1]) * eased,
          startOri[2] + (endOri[2] - startOri[2]) * eased,
        ] : null;

        // Lerp pivot if both have it
        const startPiv = boardAnim.start.pivot || [0, 0, 0];
        const endPiv = boardAnim.end.pivot || [0, 0, 0];
        const lerpedPiv = [
          startPiv[0] + (endPiv[0] - startPiv[0]) * eased,
          startPiv[1] + (endPiv[1] - startPiv[1]) * eased,
          startPiv[2] + (endPiv[2] - startPiv[2]) * eased,
        ];
        const hasPiv = lerpedPiv[0] !== 0 || lerpedPiv[1] !== 0 || lerpedPiv[2] !== 0;

        // Apply to single board
        state.setBoards(prev => prev.map(b => {
          if (b.id.toString() !== boardAnim.boardId) return b;
          return {
            ...b,
            position: lerpedPos || b.position,
            orientation: lerpedOri || b.orientation || [0, 0, 0],
            pivot: hasPiv ? lerpedPiv : undefined,
          };
        }));
      }

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
