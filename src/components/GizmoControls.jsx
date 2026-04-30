import React from 'react';
import { GizmoHelper } from '@react-three/drei';
import { CustomGizmoViewport } from './CustomGizmoViewport';

export const GizmoControls = () => (
  <GizmoHelper alignment="top-center" margin={[0, 160]}>
    <CustomGizmoViewport />
  </GizmoHelper>
);
