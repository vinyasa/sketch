/**
 * proceduralUpdaters.js
 *
 * Pure utility module containing the geometric layout calculations and parent-child board
 * updates for all parametric woodworking components (Cabinets, Shelving, Drawers, Boxes,
 * Face Frames, Shaker Doors, Table Bases, and Table Tops).
 */

import { collectChildBoards } from './sceneGraph';
import { generateCabinet } from './generators/cabinetGenerator';
import { generateBox } from './generators/boxGenerator';
import { generateFaceFrame } from './generators/faceFrameGenerator';
import { generateShelving } from './generators/shelvingGenerator';
import { generateShakerDoor } from './generators/shakerDoorGenerator';
import { generateDrawers } from './generators/drawerGenerator';
import { generateTableBase } from './generators/tableBaseGenerator';
import { generateTableTop } from './generators/tableTopGenerator';

const mergeTransientProperties = (oldBoards, newBoards) => {
  const oldMap = new Map(oldBoards.map(b => [b.id, b]));
  return newBoards.map(nb => {
    const oldB = oldMap.get(nb.id);
    if (oldB) {
      const merged = { ...nb };
      if (oldB.visible !== undefined) {
        merged.visible = oldB.visible;
      }
      return merged;
    }
    return nb;
  });
};

export const buildCabinetHelper = (cfg, boards, groups) => {
  const {
    groupId,
    savedParams,
    newBoards,
    isEditing,
    backStyle,
    tSide,
    tTB,
    tBack,
    baseId
  } = generateCabinet(cfg, boards, groups);

  const updatedGroups = { ...groups };
  if (isEditing) {
    updatedGroups[groupId] = {
      ...groups[groupId],
      meta: {
        builder: 'cabinet',
        params: savedParams
      }
    };
  } else {
    updatedGroups[groupId] = {
      parentId: 'Workspace',
      isExpanded: true,
      visible: true,
      name: 'Cabinet',
      meta: {
        builder: 'cabinet',
        params: savedParams
      }
    };
  }

  const mergedNewBoards = mergeTransientProperties(boards, newBoards);
  const newBoardIds = new Set(mergedNewBoards.map(nb => nb.id));
  const filteredBoards = boards.filter(b => !newBoardIds.has(b.id) && b.parentId !== groupId);
  const updatedBoards = [...filteredBoards, ...mergedNewBoards];

  return {
    groupId,
    savedParams,
    newBoards: mergedNewBoards,
    updatedGroups,
    updatedBoards,
    backStyle,
    tSide,
    tTB,
    tBack,
    baseId
  };
};

export const buildBoxHelper = (cfg, boards, groups) => {
  const {
    groupId,
    savedParams,
    newBoards,
    isEditing
  } = generateBox(cfg, boards, groups);

  const updatedGroups = { ...groups };
  if (isEditing) {
    updatedGroups[groupId] = {
      ...groups[groupId],
      meta: {
        builder: 'box',
        params: savedParams
      }
    };
  } else {
    updatedGroups[groupId] = {
      parentId: 'Workspace',
      isExpanded: true,
      visible: true,
      name: 'Box',
      meta: {
        builder: 'box',
        params: savedParams
      }
    };
  }

  const mergedNewBoards = mergeTransientProperties(boards, newBoards);
  const newBoardIds = new Set(mergedNewBoards.map(nb => nb.id));
  const filteredBoards = boards.filter(b => !newBoardIds.has(b.id) && b.parentId !== groupId);
  const updatedBoards = [...filteredBoards, ...mergedNewBoards];

  return {
    groupId,
    updatedGroups,
    updatedBoards
  };
};

export const buildFaceFrameHelper = (cfg, boards, groups, defaultMaterial) => {
  const {
    groupId,
    savedParams,
    newBoards,
    isEditing
  } = generateFaceFrame(cfg, boards, groups, defaultMaterial);

  const updatedGroups = { ...groups };
  if (isEditing) {
    updatedGroups[groupId] = {
      ...groups[groupId],
      meta: { builder: 'face-frame', params: savedParams }
    };
  } else {
    updatedGroups[groupId] = {
      parentId: 'Workspace',
      isExpanded: true,
      visible: true,
      name: 'Face Frame',
      meta: { builder: 'face-frame', params: savedParams }
    };
  }

  const mergedNewBoards = mergeTransientProperties(boards, newBoards);
  const newBoardIds = new Set(mergedNewBoards.map(nb => nb.id));
  const filteredBoards = boards.filter(b => !newBoardIds.has(b.id) && b.parentId !== groupId);
  const updatedBoards = [...filteredBoards, ...mergedNewBoards];

  return {
    groupId,
    updatedGroups,
    updatedBoards
  };
};

export const buildShelvingHelper = (cfg, boards, groups, defaultMaterial) => {
  const {
    groupId,
    savedParams,
    newBoards,
    isEditing,
    rootParent,
    cabinetGroupId,
    boxGroupId
  } = generateShelving(cfg, boards, groups, defaultMaterial);

  const updatedGroups = { ...groups };
  if (isEditing) {
    updatedGroups[groupId] = {
      ...groups[groupId],
      parentId: rootParent || groups[groupId].parentId || 'Workspace',
      meta: { builder: 'shelving', params: savedParams }
    };
  } else {
    updatedGroups[groupId] = {
      parentId: rootParent || 'Workspace',
      isExpanded: true,
      visible: true,
      name: 'Shelves',
      meta: { builder: 'shelving', params: savedParams }
    };
  }

  const mergedNewBoards = mergeTransientProperties(boards, newBoards);
  const newBoardIds = new Set(mergedNewBoards.map(nb => nb.id));
  const filteredBoards = boards.filter(b => !newBoardIds.has(b.id) && b.parentId !== groupId);
  let updatedBoards = [...filteredBoards, ...mergedNewBoards];

  // ── Shelf Pin Holes Generation ──────────────────────────────────────────
  const parentGroupId = cabinetGroupId || boxGroupId;
  if (parentGroupId) {
    const parentBoards = updatedBoards.filter(b => b.parentId === parentGroupId);
    const leftSide = parentBoards.find(b => b.name === 'Left Side');
    const rightSide = parentBoards.find(b => b.name === 'Right Side');

    if (leftSide && rightSide) {
      // First, always clear existing pin operations for this shelving assembly to prevent duplicates or clean them up if turned off
      updatedBoards = updatedBoards.map(b => {
        if (b.id === leftSide.id || b.id === rightSide.id) {
          return {
            ...b,
            operations: (b.operations || []).filter(op => op.parentGroupId !== groupId)
          };
        }
        return b;
      });

      const shouldAddPins = savedParams.addShelfPins === true || savedParams.addShelfPins === 'true';
      if (shouldAddPins) {
        const count = parseInt(savedParams.count ?? 3, 10);
        const H = parseFloat(savedParams.height || 48);
        const t = parseFloat(savedParams.thickness || 0.75);
        const D = parseFloat(savedParams.depth || 11);

        const parentGroup = groups[parentGroupId];
        const parentParams = parentGroup?.meta?.params || {};
        const parentH = parseFloat(parentParams.height || H);
        const parentD = parseFloat(parentParams.depth || D);
        const parentTSide = parseFloat(parentParams.thicknessSide || 0.75);
        const parentTTB = parseFloat(parentParams.thicknessTB || 0.75);
        const backStyle = parentParams.backStyle || 'flat';
        const tBack = parseFloat(parentParams.thicknessBack || 0.25);
        const tFront = parseFloat(parentParams.thicknessFront || 0.5);
        const shelfD = parentGroup?.meta?.builder === 'box'
          ? parentD - tFront - tBack
          : parentD - tBack;

        const shelfCenterLocalZ = parentGroup?.meta?.builder === 'box'
          ? (tBack - tFront) / 2
          : (backStyle === 'flat' ? 0 : tBack / 2);

        const availableHeight = H - (count * t);
        const gap = availableHeight / (count + 1);

        const pinOpsLeft = [];
        const pinOpsRight = [];
        const holeRadius = 0.125; // 1/4" diameter
        const holeDepth = Math.min(0.375, parentTSide / 2);

        const pinOffset = Math.min(2.0, shelfD / 4);
        const zFront = shelfCenterLocalZ + (shelfD / 2 - pinOffset);
        const zBack = shelfCenterLocalZ - (shelfD / 2 - pinOffset);

        for (let i = 0; i < count; i++) {
          const yCenter = gap * (i + 1) + t * i + (t / 2);
          // We drill 5 holes around yCenter spaced 1.25" apart
          for (let hIdx = -2; hIdx <= 2; hIdx++) {
            const yHole = yCenter + hIdx * 1.25;
            const localY = parentTTB + yHole - parentH / 2;

            const opIdFront = `shelving_pin_${groupId}_${i}_${hIdx}_f`;
            const opIdBack = `shelving_pin_${groupId}_${i}_${hIdx}_b`;

            // Left Side (face: 'right' inward)
            pinOpsLeft.push({
              id: opIdFront,
              type: 'hole',
              face: 'right',
              depth: holeDepth,
              radius: holeRadius,
              offset: localY,
              offsetY: zFront,
              source: 'shelving-pin-holes',
              parentGroupId: groupId
            });
            pinOpsLeft.push({
              id: opIdBack,
              type: 'hole',
              face: 'right',
              depth: holeDepth,
              radius: holeRadius,
              offset: localY,
              offsetY: zBack,
              source: 'shelving-pin-holes',
              parentGroupId: groupId
            });

            // Right Side (face: 'left' inward)
            pinOpsRight.push({
              id: opIdFront,
              type: 'hole',
              face: 'left',
              depth: holeDepth,
              radius: holeRadius,
              offset: localY,
              offsetY: zFront,
              source: 'shelving-pin-holes',
              parentGroupId: groupId
            });
            pinOpsRight.push({
              id: opIdBack,
              type: 'hole',
              face: 'left',
              depth: holeDepth,
              radius: holeRadius,
              offset: localY,
              offsetY: zBack,
              source: 'shelving-pin-holes',
              parentGroupId: groupId
            });
          }
        }

        updatedBoards = updatedBoards.map(b => {
          if (b.id === leftSide.id) {
            return {
              ...b,
              operations: [...b.operations, ...pinOpsLeft]
            };
          }
          if (b.id === rightSide.id) {
            return {
              ...b,
              operations: [...b.operations, ...pinOpsRight]
            };
          }
          return b;
        });
      }
    }
  }

  return {
    groupId,
    updatedGroups,
    updatedBoards
  };
};

export const buildShakerDoorHelper = (cfg, boards, groups, defaultMaterial) => {
  const {
    groupId,
    savedParams,
    newBoards,
    newGroups = {},
    isEditing
  } = generateShakerDoor(cfg, boards, groups, defaultMaterial);

  const nextGroups = { ...groups };
  if (isEditing) {
    // Clean up any existing nested groups under the main door group
    Object.keys(nextGroups).forEach(k => {
      let pid = nextGroups[k].parentId;
      while (pid) {
        if (pid === groupId) {
          delete nextGroups[k];
          break;
        }
        pid = nextGroups[pid]?.parentId;
      }
    });

    nextGroups[groupId] = {
      ...groups[groupId],
      meta: {
        builder: 'shaker-door',
        params: savedParams
      }
    };
  } else {
    nextGroups[groupId] = {
      parentId: 'Workspace',
      isExpanded: true,
      visible: true,
      name: 'Door',
      meta: {
        builder: 'shaker-door',
        params: savedParams
      }
    };
  }

  const updatedGroups = {
    ...nextGroups,
    ...newGroups
  };

  const mergedNewBoards = mergeTransientProperties(boards, newBoards);
  const newBoardIds = new Set(mergedNewBoards.map(nb => nb.id));
  // Filter out boards that were part of the door builder assembly or any of its subassemblies
  const filteredBoards = boards.filter(b => {
    if (!isEditing) return true;
    if (newBoardIds.has(b.id)) return false;
    if (b.parentId === groupId) return false;
    let pid = b.parentId;
    while (pid) {
      if (pid === groupId) return false;
      pid = groups[pid]?.parentId;
    }
    return true;
  });

  const updatedBoards = [...filteredBoards, ...mergedNewBoards];

  return {
    groupId,
    updatedGroups,
    updatedBoards
  };
};

export const buildDrawersHelper = (cfg, boards, groups, defaultMaterial) => {
  const {
    rootGroupId,
    newGroups,
    newBoards,
    isEditing
  } = generateDrawers(cfg, boards, groups, defaultMaterial);

  const nextGroups = { ...groups };
  if (isEditing) {
    Object.keys(nextGroups).forEach(k => {
      let pid = nextGroups[k].parentId;
      while (pid) {
        if (pid === rootGroupId) {
          delete nextGroups[k];
          break;
        }
        pid = nextGroups[pid]?.parentId;
      }
    });
  }
  const updatedGroups = {
    ...nextGroups,
    ...newGroups
  };

  const filteredBoards = boards.filter(b => {
    if (!isEditing) return true;
    let pid = b.parentId;
    while (pid) {
      if (pid === rootGroupId) return false;
      pid = groups[pid]?.parentId;
    }
    return true;
  });
  const mergedNewBoards = mergeTransientProperties(boards, newBoards);
  const updatedBoards = [...filteredBoards, ...mergedNewBoards];

  return {
    rootGroupId,
    updatedGroups,
    updatedBoards
  };
};

export const buildTableBaseHelper = (cfg, boards, groups, constraints, defaultMaterial) => {
  const {
    groupId,
    savedParams,
    newBoards,
    newConstraints,
    newGroups,
    isEditing
  } = generateTableBase(cfg, boards, groups, defaultMaterial);

  const nextGroups = { ...groups };
  if (isEditing) {
    Object.keys(nextGroups).forEach(k => {
      let pid = nextGroups[k].parentId;
      while (pid) {
        if (pid === groupId) {
          delete nextGroups[k];
          break;
        }
        pid = nextGroups[pid]?.parentId;
      }
    });
    nextGroups[groupId] = {
      ...groups[groupId],
      meta: { builder: 'table-base', params: savedParams }
    };
  } else {
    nextGroups[groupId] = {
      parentId: 'Workspace',
      isExpanded: true,
      visible: true,
      name: 'Table Base',
      meta: { builder: 'table-base', params: savedParams }
    };
  }
  const updatedGroups = {
    ...nextGroups,
    ...newGroups
  };

  const childBoards = collectChildBoards(groupId, boards, groups);
  const childBoardIds = new Set(childBoards.map(b => b.id.toString()));
  const mergedNewBoards = mergeTransientProperties(boards, newBoards);
  const newBoardIds = new Set(mergedNewBoards.map(nb => nb.id.toString()));
  
  const filteredBoards = boards.filter(b => 
    !childBoardIds.has(b.id.toString()) && 
    !newBoardIds.has(b.id.toString()) && 
    b.parentId !== groupId
  );
  const updatedBoards = [...filteredBoards, ...mergedNewBoards];

  const nextConstraints = { ...constraints };
  if (isEditing) {
    Object.keys(nextConstraints).forEach(cId => {
      const c = nextConstraints[cId];
      if (childBoardIds.has(c.boardAId) || childBoardIds.has(c.boardBId)) {
        delete nextConstraints[cId];
      }
    });
  }
  const updatedConstraints = { ...nextConstraints, ...newConstraints };

  return {
    groupId,
    updatedGroups,
    updatedBoards,
    updatedConstraints
  };
};

export const buildTableTopHelper = (cfg, boards, groups, constraints, defaultMaterial) => {
  const {
    groupId,
    savedParams,
    newBoards,
    newGroups,
    isEditing,
    hasBase,
    baseGroupId
  } = generateTableTop(cfg, boards, groups, defaultMaterial);

  const nextGroups = { ...groups };
  if (isEditing) {
    Object.keys(nextGroups).forEach(k => {
      let pid = nextGroups[k].parentId;
      while (pid) {
        if (pid === groupId) {
          delete nextGroups[k];
          break;
        }
        pid = nextGroups[pid]?.parentId;
      }
    });
    nextGroups[groupId] = {
      ...groups[groupId],
      meta: { builder: 'table-top', params: savedParams }
    };
  } else {
    nextGroups[groupId] = {
      parentId: 'Workspace',
      isExpanded: true,
      visible: true,
      name: 'Table Top',
      meta: { builder: 'table-top', params: savedParams }
    };
  }
  const updatedGroups = {
    ...nextGroups,
    ...newGroups
  };

  const childBoards = collectChildBoards(groupId, boards, groups);
  const childBoardIds = new Set(childBoards.map(b => b.id.toString()));
  const mergedNewBoards = mergeTransientProperties(boards, newBoards);
  const newBoardIds = new Set(mergedNewBoards.map(nb => nb.id.toString()));
  
  const filteredBoards = boards.filter(b => 
    !childBoardIds.has(b.id.toString()) && 
    !newBoardIds.has(b.id.toString()) && 
    b.parentId !== groupId
  );
  const updatedBoards = [...filteredBoards, ...mergedNewBoards];

  const nextConstraints = { ...constraints };
  if (isEditing) {
    Object.keys(nextConstraints).forEach(cId => {
      const c = nextConstraints[cId];
      if (childBoardIds.has(c.boardAId) || childBoardIds.has(c.boardBId)) {
        delete nextConstraints[cId];
      }
    });
  }

  return {
    groupId,
    savedParams,
    newBoards: mergedNewBoards,
    updatedGroups,
    updatedBoards,
    updatedConstraints: nextConstraints,
    hasBase,
    baseGroupId
  };
};
