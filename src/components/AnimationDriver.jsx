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
