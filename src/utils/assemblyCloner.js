import { computeWorldAABB } from './sceneGraph';

/**
 * assemblyCloner.js
 *
 * Pure utility function to clone an assembly (sub-tree group of boards, groups, and constraints).
 * Does not interact with Zustand directly, making it highly readable and testable.
 */

export const cloneAssemblyHelper = (selectedGroupId, boards, groups, constraints, cloneMode = 'worldX', cloneOffset = 10) => {
  const collectGroupSubTree = rootId => {
    const result = {};
    const traverse = currentId => {
      if (!groups[currentId]) return;
      result[currentId] = {
        ...groups[currentId]
      };
      Object.keys(groups).filter(k => groups[k].parentId === currentId).forEach(traverse);
    };
    traverse(rootId);
    return result;
  };

  const snapshotGroups = collectGroupSubTree(selectedGroupId);
  const groupIdsInAssembly = new Set(Object.keys(snapshotGroups));
  
  const snapshotBoards = boards.filter(b => {
    let pid = b.parentId;
    while (pid) {
      if (groupIdsInAssembly.has(pid)) return true;
      const pg = groups[pid];
      pid = pg ? pg.parentId : null;
    }
    return false;
  }).map(b => ({
    ...b
  }));

  const boardIdsInAssembly = new Set(snapshotBoards.map(b => b.id.toString()));
  const snapshotConstraints = {};
  Object.entries(constraints).forEach(([cId, c]) => {
    if (boardIdsInAssembly.has(c.boardAId) && boardIdsInAssembly.has(c.boardBId)) {
      snapshotConstraints[cId] = {
        ...c
      };
    }
  });

  // Calculate shift delta [dx, dy, dz] based on cloneMode and cloneOffset
  let dx = 0, dy = 0, dz = 0;
  if (cloneMode === 'local') {
    let overallSize = [0, 0, 0];
    if (snapshotBoards.length > 0) {
      const aabb = computeWorldAABB(snapshotBoards);
      overallSize = [
        Math.abs(aabb.maxX - aabb.minX),
        Math.abs(aabb.maxY - aabb.minY),
        Math.abs(aabb.maxZ - aabb.minZ)
      ];
    }
    let thinnestAxis = 0;
    if (overallSize[1] < overallSize[thinnestAxis]) thinnestAxis = 1;
    if (overallSize[2] < overallSize[thinnestAxis]) thinnestAxis = 2;

    dx = thinnestAxis === 0 ? cloneOffset : 0;
    dy = thinnestAxis === 1 ? cloneOffset : 0;
    dz = thinnestAxis === 2 ? cloneOffset : 0;
  } else if (cloneMode === 'worldX') {
    dx = cloneOffset;
  } else if (cloneMode === 'worldY') {
    dy = cloneOffset;
  } else if (cloneMode === 'worldZ') {
    dz = cloneOffset;
  } else {
    // Default fallback
    dx = 10;
    dz = 10;
  }

  const existingGroupNames = new Set(Object.keys(groups));
  const uniqueGroupName = base => {
    // Strip any trailing digits like -2, -3 from the base before cloning
    const cleanBase = base.replace(/-\d+$/, '');
    let n = 2;
    let name = `${cleanBase}-${n}`;
    while (existingGroupNames.has(name)) {
      n++;
      name = `${cleanBase}-${n}`;
    }
    existingGroupNames.add(name);
    return name;
  };

  const oldRootId = selectedGroupId;
  const groupIdMap = {};
  groupIdMap[oldRootId] = uniqueGroupName(selectedGroupId);
  Object.keys(snapshotGroups).forEach(oldId => {
    if (oldId !== oldRootId) {
      groupIdMap[oldId] = uniqueGroupName(oldId);
    }
  });

  const newRootId = groupIdMap[oldRootId];
  let nextBoardId = Math.max(0, ...boards.map(b => parseInt(b.id) || 0)) + 1;
  const boardIdMap = {};
  snapshotBoards.forEach(b => {
    boardIdMap[b.id.toString()] = nextBoardId++;
  });

  const newGroups = {};
  Object.entries(snapshotGroups).forEach(([oldId, g]) => {
    const newId = groupIdMap[oldId];
    const newParentId = oldId === oldRootId ? g.parentId : (groupIdMap[g.parentId] ?? g.parentId);
    newGroups[newId] = {
      ...g,
      parentId: newParentId
    };
  });

  const newBoards = snapshotBoards.map(b => {
    const edgeJoints = (b.edgeJoints || []).map(ej => ({
      ...ej,
      partnerId: boardIdMap[ej.partnerId]?.toString() ?? ej.partnerId
    }));
    const operations = (b.operations || []).map(op => ({
      ...op,
      partnerId: boardIdMap[op.partnerId]?.toString() ?? op.partnerId,
      cutterId: boardIdMap[op.cutterId]?.toString() ?? op.cutterId
    }));
    return {
      ...b,
      id: boardIdMap[b.id.toString()],
      parentId: groupIdMap[b.parentId] ?? b.parentId,
      position: [b.position[0] + dx, b.position[1] + dy, b.position[2] + dz],
      edgeJoints,
      operations
    };
  });

  const newConstraints = {};
  Object.entries(snapshotConstraints).forEach(([, c]) => {
    const newCId = Date.now().toString() + Math.random();
    newConstraints[newCId] = {
      ...c,
      boardAId: boardIdMap[c.boardAId]?.toString() ?? c.boardAId,
      boardBId: boardIdMap[c.boardBId]?.toString() ?? c.boardBId
    };
  });

  return {
    newBoards,
    newGroups,
    newConstraints,
    newRootId
  };
};
