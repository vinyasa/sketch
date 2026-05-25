import { computeWorldAABB, collectChildBoards } from '../../utils/sceneGraph';
import { calculateProceduralBoxWalls } from '../../utils/procedural';
import { generateCabinet } from '../../utils/generators/cabinetGenerator';
import { generateBox } from '../../utils/generators/boxGenerator';
import { generateFaceFrame } from '../../utils/generators/faceFrameGenerator';
import { generateShelving } from '../../utils/generators/shelvingGenerator';
import { generateShakerDoor } from '../../utils/generators/shakerDoorGenerator';
import { generateDrawers } from '../../utils/generators/drawerGenerator';

export const createAssemblySlice = (set, get) => ({
  cloneAssembly: selectedGroupId => {
    const {
      boards,
      groups,
      constraints,
      setBoards,
      setGroups,
      setConstraints,
      setSelectedItemIds,
      pushHistory,
      showToast
    } = get();
    if (!groups[selectedGroupId]) return;
    pushHistory();
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
      const newParentId = oldId === oldRootId ? g.parentId : groupIdMap[g.parentId] ?? g.parentId;
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
        partnerId: boardIdMap[op.partnerId]?.toString() ?? op.partnerId
      }));
      return {
        ...b,
        id: boardIdMap[b.id.toString()],
        parentId: groupIdMap[b.parentId] ?? b.parentId,
        position: [b.position[0] + 10, b.position[1], b.position[2] + 10],
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
    setGroups(prev => ({
      ...prev,
      ...newGroups
    }));
    setBoards(prev => [...prev, ...newBoards]);
    setConstraints(prev => ({
      ...prev,
      ...newConstraints
    }));
    setSelectedItemIds([newRootId]);
    showToast(`Cloned "${oldRootId}"`);
  },
  updateProceduralBox: (groupId, metaUpdates) => {
    const {
      pushHistory,
      groups,
      boards,
      setGroups,
      setBoards
    } = get();
    const curGroup = groups[groupId];
    if (!curGroup || !curGroup.meta || curGroup.meta.type !== 'procedural-box') return;
    pushHistory();
    const newMeta = {
      ...curGroup.meta,
      ...metaUpdates
    };
    setGroups(prev => ({
      ...prev,
      [groupId]: {
        ...prev[groupId],
        meta: newMeta
      }
    }));

    // Compute offset: procedural box walls are centered at the group's footprint
    // We need the center position of the group's existing boards to reposition
    const existingBoards = boards.filter(b => b.parentId === groupId);
    let offsetX = 0,
      offsetZ = 0;
    if (existingBoards.length > 0) {
      const aabb = computeWorldAABB(existingBoards);
      offsetX = (aabb.minX + aabb.maxX) / 2;
      offsetZ = (aabb.minZ + aabb.maxZ) / 2;
    }
    const wallsData = calculateProceduralBoxWalls(newMeta);
    setBoards(prev => prev.map(b => {
      if (b.parentId === groupId) {
        const mappedData = wallsData.find(wd => b.name.includes(wd.role));
        if (mappedData) {
          return {
            ...b,
            size: mappedData.size,
            position: [mappedData.position[0] + offsetX, mappedData.position[1], mappedData.position[2] + offsetZ]
          };
        }
      }
      return b;
    }));
  },
  handleAssemblyDelete: () => {
    const {
      setConfirmDialog,
      selectedItemIds,
      groups,
      pushHistory,
      boards,
      setGroups,
      setBoards,
      setSelectedItemIds
    } = get();
    const selectedGroup = selectedItemIds.length === 1 && Object.keys(groups).find(k => k === selectedItemIds[0]);
    const groupToDelete = selectedGroup;
    setConfirmDialog({
      message: `Are you sure you want to delete assembly "${groupToDelete}"? This will permanently delete ALL nested sub-assemblies and components.`,
      onConfirm: () => {
        pushHistory();
        let allGroupIdsToDel = new Set([groupToDelete]);
        let allBoardIdsToDel = new Set();
        const traverse = pId => {
          Object.keys(groups).forEach(k => {
            if (groups[k].parentId === pId && !allGroupIdsToDel.has(k)) {
              allGroupIdsToDel.add(k);
              traverse(k);
            }
          });
          boards.forEach(bd => {
            if (bd.parentId === pId) allBoardIdsToDel.add(bd.id);
          });
        };
        traverse(groupToDelete);
        setGroups(prev => {
          let nextGroups = {
            ...prev
          };
          allGroupIdsToDel.forEach(id => delete nextGroups[id]);
          return nextGroups;
        });
        setBoards(prev => prev.filter(bd => !allBoardIdsToDel.has(bd.id)));
        setSelectedItemIds(prev => prev.filter(id => !allBoardIdsToDel.has(parseInt(id)) && !allGroupIdsToDel.has(id)));
        setConfirmDialog(null);
      }
    });
  },
  // ─── Cabinet Builder ──────────────────────────────────────────────────────
  buildCabinet: cfg => {
    const {
      pushHistory,
      boards,
      groups,
      setBoards,
      setGroups,
      setSelectedItemIds
    } = get();
    pushHistory();
    
    const {
      groupId,
      savedParams,
      newBoards,
      isEditing,
      backStyle,
      tSide,
      tTB,
      tBack,
      baseId,
      oldIdMap
    } = generateCabinet(cfg, boards, groups);

    if (isEditing) {
      setGroups(prev => ({
        ...prev,
        [groupId]: {
          ...prev[groupId],
          meta: {
            builder: 'cabinet',
            params: savedParams
          }
        }
      }));
    } else {
      setGroups(prev => ({
        ...prev,
        [groupId]: {
          parentId: 'Workspace',
          isExpanded: true,
          visible: true,
          name: 'Cabinet',
          meta: {
            builder: 'cabinet',
            params: savedParams
          }
        }
      }));
    }

    setBoards(prev => {
      const newBoardIds = new Set(newBoards.map(nb => nb.id));
      const filtered = prev.filter(b => !newBoardIds.has(b.id) && b.parentId !== groupId);
      return [...filtered, ...newBoards];
    });
    setSelectedItemIds([groupId]);

    setTimeout(() => {
      const {
        setBoards
      } = get();
      const bottomId = newBoards[0].id;
      const topId = newBoards[1].id;
      const leftId = newBoards[2].id;
      const rightId = newBoards[3].id;
      const backId = newBoards[4].id;

      if (backStyle === 'inset') {
        setTimeout(() => {
          const backIdStr = backId.toString();
          setBoards(prev => prev.map(b => {
            if (['Bottom', 'Top', 'Left Side', 'Right Side'].includes(b.name) && b.parentId === groupId) {
              const joint = {
                type: 'rabbet',
                partnerId: backIdStr,
                overBoardId: b.id.toString(),
                shrinkAxis: 2,
                shrinkAmount: b.name.includes('Side') ? tSide / 2 : tTB / 2,
                thicknessA: b.name.includes('Side') ? tSide : tTB,
                thicknessB: tBack,
                signA: -1,
                signB: 1
              };
              return {
                ...b,
                edgeJoints: [...(b.edgeJoints || []), joint]
              };
            }
            if (b.name === 'Back' && b.parentId === groupId) {
              const sideIds = [bottomId, topId, leftId, rightId].map(String);
              const newJoints = sideIds.map((id, idx) => ({
                type: 'rabbet',
                partnerId: id,
                overBoardId: id,
                shrinkAmount: idx < 2 ? tTB / 2 : tSide / 2,
                thicknessA: idx < 2 ? tTB : tSide,
                thicknessB: tBack,
                shrinkAxis: 2,
                signA: -1,
                signB: 1
              }));
              return {
                ...b,
                edgeJoints: [...(b.edgeJoints || []), ...newJoints]
              };
            }
            return b;
          }));
        }, 10);
      }
    }, 10);
  },
  // ─── Box Builder ──────────────────────────────────────────────────────────
  buildBox: cfg => {
    const {
      pushHistory,
      boards,
      groups,
      setBoards,
      setGroups,
      setSelectedItemIds
    } = get();
    pushHistory();

    const {
      groupId,
      savedParams,
      newBoards,
      isEditing
    } = generateBox(cfg, boards, groups);

    if (isEditing) {
      setGroups(prev => ({
        ...prev,
        [groupId]: {
          ...prev[groupId],
          meta: {
            builder: 'box',
            params: savedParams
          }
        }
      }));
    } else {
      setGroups(prev => ({
        ...prev,
        [groupId]: {
          parentId: 'Workspace',
          isExpanded: true,
          visible: true,
          name: 'Box',
          meta: {
            builder: 'box',
            params: savedParams
          }
        }
      }));
    }

    setBoards(prev => {
      const newBoardIds = new Set(newBoards.map(nb => nb.id));
      const filtered = prev.filter(b => !newBoardIds.has(b.id) && b.parentId !== groupId);
      return [...filtered, ...newBoards];
    });
    setSelectedItemIds([groupId]);
  },
  // ─── Face Frame Builder ───────────────────────────────────────────────────
  buildFaceFrame: cfg => {
    const { pushHistory, boards, groups, setBoards, setGroups, setSelectedItemIds, defaultMaterial } = get();
    pushHistory();

    const {
      groupId,
      savedParams,
      newBoards,
      isEditing
    } = generateFaceFrame(cfg, boards, groups, defaultMaterial);

    if (isEditing) {
      setGroups(prev => ({
        ...prev,
        [groupId]: { ...prev[groupId], meta: { builder: 'face-frame', params: savedParams } }
      }));
    } else {
      setGroups(prev => ({
        ...prev,
        [groupId]: {
          parentId: 'Workspace', isExpanded: true, visible: true, name: 'Face Frame',
          meta: { builder: 'face-frame', params: savedParams }
        }
      }));
    }

    setBoards(prev => {
      const newBoardIds = new Set(newBoards.map(nb => nb.id));
      const filtered = prev.filter(b => !newBoardIds.has(b.id) && b.parentId !== groupId);
      return [...filtered, ...newBoards];
    });
    setSelectedItemIds([groupId]);
  },
  // ─── Shelving Builder ─────────────────────────────────────────────────────
  buildShelving: cfg => {
    const { pushHistory, boards, groups, setBoards, setGroups, setSelectedItemIds, defaultMaterial } = get();
    pushHistory();

    const {
      groupId,
      savedParams,
      newBoards,
      isEditing
    } = generateShelving(cfg, boards, groups, defaultMaterial);

    if (isEditing) {
      setGroups(prev => ({
        ...prev,
        [groupId]: { ...prev[groupId], meta: { builder: 'shelving', params: savedParams } }
      }));
    } else {
      setGroups(prev => ({
        ...prev,
        [groupId]: {
          parentId: 'Workspace', isExpanded: true, visible: true, name: 'Shelves',
          meta: { builder: 'shelving', params: savedParams }
        }
      }));
    }

    setBoards(prev => {
      const newBoardIds = new Set(newBoards.map(nb => nb.id));
      const filtered = prev.filter(b => !newBoardIds.has(b.id) && b.parentId !== groupId);
      return [...filtered, ...newBoards];
    });
    setSelectedItemIds([groupId]);
  },
  // ─── Shaker Door Builder ──────────────────────────────────────────────────
  buildShakerDoor: cfg => {
    const {
      pushHistory,
      boards,
      groups,
      setBoards,
      setGroups,
      setSelectedItemIds,
      defaultMaterial
    } = get();
    pushHistory();

    const {
      groupId,
      savedParams,
      newBoards,
      isEditing
    } = generateShakerDoor(cfg, boards, groups, defaultMaterial);

    if (isEditing) {
      setGroups(prev => ({
        ...prev,
        [groupId]: {
          ...prev[groupId],
          meta: {
            builder: 'shaker-door',
            params: savedParams
          }
        }
      }));
    } else {
      setGroups(prev => ({
        ...prev,
        [groupId]: {
          parentId: 'Workspace',
          isExpanded: true,
          visible: true,
          name: 'Shaker Door',
          meta: {
            builder: 'shaker-door',
            params: savedParams
          }
        }
      }));
    }

    setBoards(prev => {
      const newBoardIds = new Set(newBoards.map(nb => nb.id));
      const filtered = prev.filter(b => !newBoardIds.has(b.id) && b.parentId !== groupId);
      return [...filtered, ...newBoards];
    });
    setSelectedItemIds([groupId]);
  },
  // ─── Drawer Stack Builder ─────────────────────────────────────────────────
  buildDrawers: cfg => {
    const {
      pushHistory,
      boards,
      groups,
      setBoards,
      setGroups,
      setSelectedItemIds,
      defaultMaterial
    } = get();
    pushHistory();

    const {
      rootGroupId,
      newGroups,
      newBoards,
      isEditing
    } = generateDrawers(cfg, boards, groups, defaultMaterial);

    setGroups(prev => {
      const next = {
        ...prev
      };
      if (isEditing) {
        Object.keys(next).forEach(k => {
          let pid = next[k].parentId;
          while (pid) {
            if (pid === rootGroupId) {
              delete next[k];
              break;
            }
            pid = next[pid]?.parentId;
          }
        });
      }
      return {
        ...next,
        ...newGroups
      };
    });
    setBoards(prev => {
      const filtered = prev.filter(b => {
        if (!isEditing) return true;
        let pid = b.parentId;
        while (pid) {
          if (pid === rootGroupId) return false;
          pid = groups[pid]?.parentId;
        }
        return true;
      });
      return [...filtered, ...newBoards];
    });
    setSelectedItemIds([rootGroupId]);
  },
  manualAddAssembly: () => {
    const {
      pushHistory,
      selectedItemIds,
      groups,
      boards,
      setGroups,
      setSelectedItemIds
    } = get();
    const selectedBoard = selectedItemIds.length === 1 && boards.find(b => b.id.toString() === selectedItemIds[0]);
    const selectedGroup = selectedItemIds.length === 1 && Object.keys(groups).find(k => k === selectedItemIds[0]);
    pushHistory();
    const newId = 'Assembly ' + Math.floor(Math.random() * 1000);
    const targetParent = selectedGroup || (selectedBoard ? selectedBoard.parentId : 'Workspace');
    setGroups(prev => ({
      ...prev,
      [newId]: {
        parentId: targetParent,
        isExpanded: true,
        visible: true
      }
    }));
    setSelectedItemIds([newId]);
  },
  // ─── Assembly Gluing ──────────────────────────────────────────────────────────

  glueAssembly: groupId => {
    const {
      pushHistory,
      groups,
      boards,
      constraints,
      setConstraints,
      showToast
    } = get();

    // Find all boards within the group subtree
    const childBoards = boards.filter(b => {
      let pid = b.parentId;
      while (pid) {
        if (pid === groupId) return true;
        const pg = groups[pid];
        pid = pg ? pg.parentId : null;
      }
      return false;
    });
    if (childBoards.length < 2) {
      showToast('Assembly must contain at least 2 boards to glue.');
      return;
    }
    pushHistory();

    // Implement Star Topology spanning tree:
    // Root is the first board. We create N-1 glue constraints 
    // linking every other board to the root board.
    const rootBoard = childBoards[0];
    const newConstraints = {};
    let addedCount = 0;
    for (let i = 1; i < childBoards.length; i++) {
      const targetBoard = childBoards[i];

      // Offset from root to target
      const offset = [targetBoard.position[0] - rootBoard.position[0], targetBoard.position[1] - rootBoard.position[1], targetBoard.position[2] - rootBoard.position[2]];
      const constraintId = `glue_auto_${Date.now()}_${i}`;
      newConstraints[constraintId] = {
        type: 'Glue',
        boardAId: rootBoard.id.toString(),
        boardBId: targetBoard.id.toString(),
        offset,
        enabled: true
      };
      addedCount++;
    }
    setConstraints(prev => ({
      ...prev,
      ...newConstraints
    }));
    showToast(`Glued assembly: ${addedCount} rigid links created.`);
  },
  unglueAssembly: groupId => {
    const {
      pushHistory,
      groups,
      boards,
      constraints,
      setConstraints,
      showToast
    } = get();

    // Find all boards within the group subtree
    const childBoards = boards.filter(b => {
      let pid = b.parentId;
      while (pid) {
        if (pid === groupId) return true;
        const pg = groups[pid];
        pid = pg ? pg.parentId : null;
      }
      return false;
    });
    if (childBoards.length < 2) return;
    pushHistory();
    const childIds = new Set(childBoards.map(b => b.id.toString()));
    let removedCount = 0;
    const nextConstraints = {
      ...constraints
    };
    Object.keys(nextConstraints).forEach(cid => {
      const c = nextConstraints[cid];
      if (c.type === 'Glue' && childIds.has(c.boardAId) && childIds.has(c.boardBId)) {
        delete nextConstraints[cid];
        removedCount++;
      }
    });
    setConstraints(nextConstraints);
    showToast(`Unglued assembly: ${removedCount} links removed.`);
  },
  createPivotProxy: groupId => {
    const {
      pushHistory,
      groups,
      boards,
      setGroups,
      setBoards,
      setSelectedItemIds,
      showToast
    } = get();
    const childBoards = collectChildBoards(groupId, boards, groups);
    if (childBoards.length === 0) {
      showToast('Assembly is empty.');
      return;
    }
    pushHistory();

    // 1. Calculate bounding box
    const aabb = computeWorldAABB(childBoards);
    const w = aabb.maxX - aabb.minX;
    const h = aabb.maxY - aabb.minY;
    const d = aabb.maxZ - aabb.minZ;
    const cx = aabb.minX + w / 2;
    const cy = aabb.minY + h / 2;
    const cz = aabb.minZ + d / 2;

    // 2. Hide the original assembly group
    setGroups(prev => ({
      ...prev,
      [groupId]: {
        ...prev[groupId],
        visible: false
      }
    }));

    // 3. Spawn proxy board
    const proxyIdNum = Date.now();
    const groupName = groups[groupId]?.name || 'Assembly';
    const proxyBoard = {
      id: proxyIdNum,
      parentId: groups[groupId]?.parentId || 'Workspace',
      name: `Proxy: ${groupName}`,
      size: [w, h, d],
      position: [cx, cy, cz],
      orientation: [0, 0, 0],
      pivot: [0, 0, 0],
      // Center pivot by default
      material: 'ghost',
      // We can use a special string or just default wood, but we'll try to visually distinguish it
      joint: 'None',
      operations: [],
      meta: {
        isProxy: true,
        targetGroupId: groupId
      }
    };
    setBoards(prev => [...prev, proxyBoard]);
    setSelectedItemIds([proxyIdNum.toString()]);
    showToast('Pivot Proxy created. Assembly hidden.');
  }
});