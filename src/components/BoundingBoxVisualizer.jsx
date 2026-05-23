import React from 'react';
import * as THREE from 'three';
import useStore from '../store/useStore';
import { computeWorldAABB } from '../utils/sceneGraph';

export function BoundingBoxVisualizer({ boards, groups, selectedItemIds, showBoundingBox, theme }) {
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
}
