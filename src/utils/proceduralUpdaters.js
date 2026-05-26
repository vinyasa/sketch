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

  const newBoardIds = new Set(newBoards.map(nb => nb.id));
  const filteredBoards = boards.filter(b => !newBoardIds.has(b.id) && b.parentId !== groupId);
  const updatedBoards = [...filteredBoards, ...newBoards];

  return {
    groupId,
    savedParams,
    newBoards,
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

  const newBoardIds = new Set(newBoards.map(nb => nb.id));
  const filteredBoards = boards.filter(b => !newBoardIds.has(b.id) && b.parentId !== groupId);
  const updatedBoards = [...filteredBoards, ...newBoards];

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

  const newBoardIds = new Set(newBoards.map(nb => nb.id));
  const filteredBoards = boards.filter(b => !newBoardIds.has(b.id) && b.parentId !== groupId);
  const updatedBoards = [...filteredBoards, ...newBoards];

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
    isEditing
  } = generateShelving(cfg, boards, groups, defaultMaterial);

  const updatedGroups = { ...groups };
  if (isEditing) {
    updatedGroups[groupId] = {
      ...groups[groupId],
      meta: { builder: 'shelving', params: savedParams }
    };
  } else {
    updatedGroups[groupId] = {
      parentId: 'Workspace',
      isExpanded: true,
      visible: true,
      name: 'Shelves',
      meta: { builder: 'shelving', params: savedParams }
    };
  }

  const newBoardIds = new Set(newBoards.map(nb => nb.id));
  const filteredBoards = boards.filter(b => !newBoardIds.has(b.id) && b.parentId !== groupId);
  const updatedBoards = [...filteredBoards, ...newBoards];

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
    isEditing
  } = generateShakerDoor(cfg, boards, groups, defaultMaterial);

  const updatedGroups = { ...groups };
  if (isEditing) {
    updatedGroups[groupId] = {
      ...groups[groupId],
      meta: {
        builder: 'shaker-door',
        params: savedParams
      }
    };
  } else {
    updatedGroups[groupId] = {
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

  const newBoardIds = new Set(newBoards.map(nb => nb.id));
  const filteredBoards = boards.filter(b => !newBoardIds.has(b.id) && b.parentId !== groupId);
  const updatedBoards = [...filteredBoards, ...newBoards];

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
  const updatedBoards = [...filteredBoards, ...newBoards];

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
  const newBoardIds = new Set(newBoards.map(nb => nb.id.toString()));
  
  const filteredBoards = boards.filter(b => 
    !childBoardIds.has(b.id.toString()) && 
    !newBoardIds.has(b.id.toString()) && 
    b.parentId !== groupId
  );
  const updatedBoards = [...filteredBoards, ...newBoards];

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
  const newBoardIds = new Set(newBoards.map(nb => nb.id.toString()));
  
  const filteredBoards = boards.filter(b => 
    !childBoardIds.has(b.id.toString()) && 
    !newBoardIds.has(b.id.toString()) && 
    b.parentId !== groupId
  );
  const updatedBoards = [...filteredBoards, ...newBoards];

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
    newBoards,
    updatedGroups,
    updatedBoards,
    updatedConstraints: nextConstraints,
    hasBase,
    baseGroupId
  };
};
