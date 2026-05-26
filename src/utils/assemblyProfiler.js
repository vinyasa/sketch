/**
 * assemblyProfiler.js
 *
 * Mathematical edge-exposure utility to apply joint profiling (roundovers, chamfers)
 * across the outer perimeter of a group of boards or multi-selection.
 * Automatically identifies exposed outer edges in 3D using Oriented Bounding Boxes (OBB)
 * and generates board-level operations.
 */

import * as THREE from 'three';
import { computeWorldAABB } from './sceneGraph';

/**
 * Helper to get the 4 adjacent edges, midpoints, and outward normals for a local face.
 */
const getFaceEdges = (faceChar, faceSign, size) => {
  const axes = ['x', 'y', 'z'];
  const faceAxisIdx = axes.indexOf(faceChar);
  const otherAxes = [0, 1, 2].filter(i => i !== faceAxisIdx);
  const axisAIdx = otherAxes[0];
  const axisBIdx = otherAxes[1];
  
  const faceSignChar = faceSign >= 0 ? '+' : '-';
  const faceStr = faceChar + faceSignChar;
  
  const edges = [];
  const adjConfigs = [
    { idx: axisAIdx, sign: 1 },
    { idx: axisAIdx, sign: -1 },
    { idx: axisBIdx, sign: 1 },
    { idx: axisBIdx, sign: -1 }
  ];
  
  adjConfigs.forEach(adj => {
    const adjChar = axes[adj.idx];
    const adjSignChar = adj.sign >= 0 ? '+' : '-';
    
    // Standard edge string format e.g. "y+x+"
    const edgeCode = `${faceStr}${adjChar}${adjSignChar}`;
    
    // Local midpoint of the edge (centered along the run axis)
    const localMidpoint = [0, 0, 0];
    localMidpoint[faceAxisIdx] = faceSign * size[faceAxisIdx] / 2;
    localMidpoint[adj.idx] = adj.sign * size[adj.idx] / 2;
    // Remaining axis is 0 (centered)
    
    // Local outward edge normal (pointing away from adjacent face)
    const localEdgeNormal = [0, 0, 0];
    localEdgeNormal[adj.idx] = adj.sign;
    
    edges.push({
      edgeCode,
      localMidpoint,
      localEdgeNormal
    });
  });
  
  return edges;
};

/**
 * Transforms a local board coordinate to world coordinate space, respecting orientation and pivot.
 */
const localToWorld = (localPoint, board, quaternion) => {
  const pivot = board.pivot || [0, 0, 0];
  const rotated = new THREE.Vector3(
    localPoint[0] - pivot[0],
    localPoint[1] - pivot[1],
    localPoint[2] - pivot[2]
  ).applyQuaternion(quaternion);
  return new THREE.Vector3(...board.position).add(rotated);
};

/**
 * Transforms a local normal vector to world space, respecting orientation.
 */
const localNormalToWorld = (localNormal, quaternion) => {
  return new THREE.Vector3(...localNormal).applyQuaternion(quaternion);
};

/**
 * Apply a smart edge profile to the exposed perimeter edges of the selected boards.
 */
export const applyAssemblyProfileHelper = (selectedBoards, faceDirection, profileType, profileParams, boards) => {
  if (!selectedBoards || selectedBoards.length === 0) {
    return { success: false, newBoards: boards };
  }

  // 1. Calculate overall AABB of the selection
  const overallAABB = computeWorldAABB(selectedBoards);
  
  // Define world normal and axis for the selected faceDirection
  let worldNormal, faceAxisIdx, faceExtremeVal, isPositiveSign;
  
  switch (faceDirection) {
    case 'top':
      worldNormal = new THREE.Vector3(0, 1, 0);
      faceAxisIdx = 1;
      faceExtremeVal = overallAABB.maxY;
      isPositiveSign = true;
      break;
    case 'bottom':
      worldNormal = new THREE.Vector3(0, -1, 0);
      faceAxisIdx = 1;
      faceExtremeVal = overallAABB.minY;
      isPositiveSign = false;
      break;
    case 'front':
      worldNormal = new THREE.Vector3(0, 0, 1);
      faceAxisIdx = 2;
      faceExtremeVal = overallAABB.maxZ;
      isPositiveSign = true;
      break;
    case 'back':
      worldNormal = new THREE.Vector3(0, 0, -1);
      faceAxisIdx = 2;
      faceExtremeVal = overallAABB.minZ;
      isPositiveSign = false;
      break;
    case 'left':
      worldNormal = new THREE.Vector3(-1, 0, 0);
      faceAxisIdx = 0;
      faceExtremeVal = overallAABB.minX;
      isPositiveSign = false;
      break;
    case 'right':
      worldNormal = new THREE.Vector3(1, 0, 0);
      faceAxisIdx = 0;
      faceExtremeVal = overallAABB.maxX;
      isPositiveSign = true;
      break;
    default:
      return { success: false, newBoards: boards };
  }

  // Helper to identify fastener boards
  const isFastener = b => 
    b.meta?.isFastenerElement || 
    b.name?.includes('Domino') || 
    b.name?.includes('Dowel') || 
    b.parentId?.toString().includes('Joint Fasteners');

  // 2. Identify candidate boards whose face is flush with the overall bounding box face
  const candidateBoards = selectedBoards.filter(b => {
    // Exclude proxy boards or visual fasteners
    if (b.meta?.isProxy || isFastener(b)) return false;
    
    const bAABB = computeWorldAABB([b]);
    const boardVal = isPositiveSign ? bAABB[faceAxisIdx === 0 ? 'maxX' : faceAxisIdx === 1 ? 'maxY' : 'maxZ']
                                   : bAABB[faceAxisIdx === 0 ? 'minX' : faceAxisIdx === 1 ? 'minY' : 'minZ'];
    // 0.15" tolerance for flush face detection
    return Math.abs(boardVal - faceExtremeVal) < 0.15;
  });

  if (candidateBoards.length === 0) {
    return { success: false, newBoards: boards };
  }

  // pre-build individual board AABB maps for fast lookup
  const boardAABBMaps = {};
  selectedBoards.forEach(b => {
    boardAABBMaps[b.id] = computeWorldAABB([b]);
  });

  const selectedBoardIds = new Set(selectedBoards.map(b => b.id));

  // 3. Strip any existing assembly-profile operations for this faceDirection from the selected boards
  const preCleanedBoards = boards.map(b => {
    if (!selectedBoardIds.has(b.id)) return b;
    const cleanOps = (b.operations || []).filter(op => {
      return !(op.source === 'assembly-profile' && op.meta?.faceDirection === faceDirection);
    });
    return { ...b, operations: cleanOps };
  });

  // 4. Run exposure check on each candidate board
  const finalBoardsMap = {};
  
  candidateBoards.forEach(b => {
    const euler = new THREE.Euler(
      b.orientation?.[0] || 0,
      b.orientation?.[1] || 0,
      b.orientation?.[2] || 0,
      'YXZ'
    );
    const quaternion = new THREE.Quaternion().setFromEuler(euler);
    
    // Map world normal to local coordinates to identify the local face
    const localNormalVec = worldNormal.clone().applyQuaternion(quaternion.clone().invert());
    
    const axesVec = [localNormalVec.x, localNormalVec.y, localNormalVec.z];
    let maxVal = -1;
    let localAxisIdx = 0;
    let localSign = 1;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(axesVec[i]) > maxVal) {
        maxVal = Math.abs(axesVec[i]);
        localAxisIdx = i;
        localSign = axesVec[i] >= 0 ? 1 : -1;
      }
    }
    
    const localFaceChar = ['x', 'y', 'z'][localAxisIdx];
    
    // Generate 4 adjacent edges
    const faceEdges = getFaceEdges(localFaceChar, localSign, b.size);
    const newOperations = [];

    faceEdges.forEach(edge => {
      // Find world midpoint and outward normal
      const worldMid = localToWorld(edge.localMidpoint, b, quaternion);
      const worldNorm = localNormalToWorld(edge.localEdgeNormal, quaternion);
      
      // Shift point slightly outward along the edge normal
      const shiftDistance = 0.08; // 0.08" outward shift
      const testPoint = worldMid.clone().addScaledVector(worldNorm, shiftDistance);
      
      // Check if testPoint falls inside any other board's expanded bounding box
      let isBlocked = false;
      const epsilon = 0.05; // 0.05" tolerance
      
      for (const other of selectedBoards) {
        if (other.id === b.id || other.meta?.isProxy || isFastener(other)) continue;
        
        const box = boardAABBMaps[other.id];
        if (box) {
          const inBox = testPoint.x >= box.minX - epsilon &&
                        testPoint.x <= box.maxX + epsilon &&
                        testPoint.y >= box.minY - epsilon &&
                        testPoint.y <= box.maxY + epsilon &&
                        testPoint.z >= box.minZ - epsilon &&
                        testPoint.z <= box.maxZ + epsilon;
          if (inBox) {
            isBlocked = true;
            break;
          }
        }
      }
      
      if (!isBlocked) {
        // Edge is exposed! Add the edge profile operation
        newOperations.push({
          id: `op_prof_${faceDirection}_${edge.edgeCode}_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
          type: 'edge-profile',
          profile: profileType,
          edge: edge.edgeCode,
          radius: profileParams.radius || 0.25,
          width: profileParams.width || 0.25,
          source: 'assembly-profile',
          meta: {
            faceDirection,
            groupId: b.parentId || 'selection'
          }
        });
      }
    });

    if (newOperations.length > 0) {
      const cleanB = preCleanedBoards.find(pcb => pcb.id === b.id);
      if (cleanB) {
        finalBoardsMap[b.id] = {
          ...cleanB,
          operations: [...(cleanB.operations || []), ...newOperations]
        };
      }
    }
  });

  // Rebuild the final boards array with modified candidates
  const finalBoards = preCleanedBoards.map(b => finalBoardsMap[b.id] || b);
  
  return { success: true, newBoards: finalBoards };
};

/**
 * Remove any assembly-profile operations for the given faceDirection from the selected boards.
 */
export const clearAssemblyProfileHelper = (selectedBoards, faceDirection, boards) => {
  if (!selectedBoards || selectedBoards.length === 0) return { success: false, newBoards: boards };

  const selectedBoardIds = new Set(selectedBoards.map(b => b.id));
  
  const nextBoards = boards.map(b => {
    if (!selectedBoardIds.has(b.id)) return b;
    const cleanOps = (b.operations || []).filter(op => {
      return !(op.source === 'assembly-profile' && op.meta?.faceDirection === faceDirection);
    });
    return { ...b, operations: cleanOps };
  });

  return { success: true, newBoards: nextBoards };
};
