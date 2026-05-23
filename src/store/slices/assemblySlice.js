import { computeWorldAABB, collectChildBoards } from '../../utils/sceneGraph';
import { calculateProceduralBoxWalls } from '../../utils/procedural';

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
  // Creates a 6-panel cabinet assembly with:
  //   • Top / Bottom: full width, overlap sides (for dado joints)
  //   • Left / Right: full height, sit inside the top/bottom width
  //   • Front / Back: full width × height, flush-attached (no overlap), add to total depth
  //   • Back-bottom-left corner at world origin (0,0,0)
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
    const parseNum = (val, def) => {
      if (val === undefined || val === null || val === '') return def;
      const n = parseFloat(val);
      return isNaN(n) ? def : n;
    };
    const W = parseNum(cfg.width, 24);
    const H = parseNum(cfg.height, 30);
    const D = parseNum(cfg.depth, 14);
    const tTB = parseNum(cfg.thicknessTB, 0.75);
    const tSide = parseNum(cfg.thicknessSide, 0.75);
    const tFront = parseNum(cfg.thicknessFront, 0.75);
    const tBack = parseNum(cfg.thicknessBack, 0.25);
    const backStyle = cfg.backStyle ?? 'flat';
    const coreD = backStyle === 'flat' ? D - tBack : D;
    const isEditing = !!cfg.editGroupId;
    const groupId = isEditing ? cfg.editGroupId : 'Cabinet ' + Math.floor(Math.random() * 1000);

    // Strip out editGroupId before saving params
    const {
      editGroupId,
      ...savedParams
    } = cfg;
    let offset = [
      parseNum(cfg.offsetX, 0),
      parseNum(cfg.offsetY, 0),
      parseNum(cfg.offsetZ, 0)
    ];
    const oldIdMap = {};
    if (isEditing) {
      const childBoards = collectChildBoards(groupId, boards, groups);
      if (childBoards.length > 0) {
        const aabb = computeWorldAABB(childBoards);
        offset = [aabb.minX, aabb.minY, aabb.minZ];
      }
      childBoards.forEach(b => {
        oldIdMap[b.name] = b.id;
      });
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
    const coreMidZ = backStyle === 'flat' ? tBack + coreD / 2 : coreD / 2;
    let backSize, backPos;
    if (backStyle === 'flat') {
      backSize = [W, H, tBack];
      backPos = [W / 2, H / 2, tBack / 2];
    } else {
      backSize = [W - tSide, H - tTB, tBack];
      backPos = [W / 2, H / 2, tBack / 2];
    }
    let panelDefs = [{
      name: 'Bottom',
      size: [W - 2 * tSide, tTB, coreD],
      position: [W / 2, tTB / 2, coreMidZ]
    }, {
      name: 'Top',
      size: [W - 2 * tSide, tTB, coreD],
      position: [W / 2, H - tTB / 2, coreMidZ]
    }, {
      name: 'Left Side',
      size: [tSide, H, coreD],
      position: [tSide / 2, H / 2, coreMidZ]
    }, {
      name: 'Right Side',
      size: [tSide, H, coreD],
      position: [W - tSide / 2, H / 2, coreMidZ]
    }, {
      name: 'Back',
      size: backSize,
      position: backPos
    }, {
      name: 'Front',
      size: [W, H, tFront],
      position: [W / 2, H / 2, D + tFront / 2]
    }];
    const baseId = Date.now();
    const newBoards = panelDefs.map((pd, i) => {
      const assignedId = oldIdMap[pd.name] || baseId + i;
      const b = {
        id: assignedId,
        name: pd.name,
        parentId: groupId,
        size: pd.size,
        position: [pd.position[0] + offset[0], pd.position[1] + offset[1], pd.position[2] + offset[2]],
        material: 'Plywood',
        joint: 'None',
        shape: 'box',
        operations: [],
        edgeJoints: [] // Reset edge joints
      };
      if (backStyle === 'inset') {
        const backId = oldIdMap['Back'] || baseId + 4;
        const rOp = {
          type: 'dado',
          direction: b.name.includes('Side') ? 'y' : 'x',
          width: tBack,
          depth: b.name.includes('Side') ? tSide / 2 : tTB / 2,
          offset: -coreD / 2 + tBack / 2,
          length: 0,
          lengthOffset: 0,
          source: 'edge-joint',
          partnerId: backId.toString()
        };
        if (b.name === 'Left Side') {
          b.operations.push({
            ...rOp,
            id: Date.now() + Math.random(),
            face: 'right'
          });
        } else if (b.name === 'Right Side') {
          b.operations.push({
            ...rOp,
            id: Date.now() + Math.random(),
            face: 'left'
          });
        } else if (b.name === 'Bottom') {
          b.operations.push({
            ...rOp,
            id: Date.now() + Math.random(),
            face: 'top'
          });
        } else if (b.name === 'Top') {
          b.operations.push({
            ...rOp,
            id: Date.now() + Math.random(),
            face: 'bottom'
          });
        }
      }
      return b;
    });

    // Atomic update to replace old boards matching these IDs, insert new ones, and delete orphans
    setBoards(prev => {
      const newBoardIds = new Set(newBoards.map(nb => nb.id));
      const filtered = prev.filter(b => !newBoardIds.has(b.id) && b.parentId !== groupId);
      return [...filtered, ...newBoards];
    });
    setSelectedItemIds([groupId]);
    setTimeout(() => {
      const {
        applyEdgeJoint,
        setBoards
      } = get();
      const bottomId = newBoards[0].id;
      const topId = newBoards[1].id;
      const leftId = newBoards[2].id;
      const rightId = newBoards[3].id;
      const backId = newBoards[4].id;

      // Natively geometric butt joints, no applyEdgeJoint needed.

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
                shrinkAxis: 2,
                shrinkAmount: idx < 2 ? tTB / 2 : tSide / 2,
                thicknessA: idx < 2 ? tTB : tSide,
                thicknessB: tBack,
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
    const parseNum = (val, def) => {
      if (val === undefined || val === null || val === '') return def;
      const n = parseFloat(val);
      return isNaN(n) ? def : n;
    };
    const W = parseNum(cfg.width, 18);
    const H = parseNum(cfg.height, 12);
    const D = parseNum(cfg.depth, 12);
    const tTB = parseNum(cfg.thicknessTB, 0.5);
    const tSide = parseNum(cfg.thicknessSide, 0.5);
    const tFront = parseNum(cfg.thicknessFront, 0.5);
    const tBack = parseNum(cfg.thicknessBack, 0.5);
    const isEditing = !!cfg.editGroupId;
    const groupId = isEditing ? cfg.editGroupId : 'Box ' + Math.floor(Math.random() * 1000);

    // Strip out editGroupId before saving params
    const {
      editGroupId,
      ...savedParams
    } = cfg;
    let offset = [
      parseNum(cfg.offsetX, 0),
      parseNum(cfg.offsetY, 0),
      parseNum(cfg.offsetZ, 0)
    ];
    const oldIdMap = {};
    if (isEditing) {
      const childBoards = collectChildBoards(groupId, boards, groups);
      if (childBoards.length > 0) {
        const aabb = computeWorldAABB(childBoards);
        offset = [aabb.minX, aabb.minY, aabb.minZ];
      }
      childBoards.forEach(b => {
        oldIdMap[b.name] = b.id;
      });
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
    const coreH = H - 2 * tTB;
    const coreD = D - tFront - tBack;
    let panelDefs = [{
      name: 'Bottom',
      size: [W, tTB, D],
      position: [W / 2, tTB / 2, D / 2]
    }, {
      name: 'Top',
      size: [W, tTB, D],
      position: [W / 2, H - tTB / 2, D / 2]
    }, {
      name: 'Left Side',
      size: [tSide, coreH, coreD],
      position: [tSide / 2, H / 2, D / 2]
    }, {
      name: 'Right Side',
      size: [tSide, coreH, coreD],
      position: [W - tSide / 2, H / 2, D / 2]
    }, {
      name: 'Back',
      size: [W, coreH, tBack],
      position: [W / 2, H / 2, tBack / 2]
    }, {
      name: 'Front',
      size: [W, coreH, tFront],
      position: [W / 2, H / 2, D - tFront / 2]
    }];
    const baseId = Date.now();
    const newBoards = panelDefs.map((pd, i) => {
      const assignedId = oldIdMap[pd.name] || baseId + i;
      const b = {
        id: assignedId,
        name: pd.name,
        parentId: groupId,
        size: pd.size,
        position: [pd.position[0] + offset[0], pd.position[1] + offset[1], pd.position[2] + offset[2]],
        material: 'Plywood',
        joint: 'None',
        shape: 'box',
        operations: [],
        edgeJoints: [] // Reset edge joints
      };
      return b;
    });

    // Atomic update to replace old boards matching these IDs, insert new ones, and delete orphans
    setBoards(prev => {
      const newBoardIds = new Set(newBoards.map(nb => nb.id));
      const filtered = prev.filter(b => !newBoardIds.has(b.id) && b.parentId !== groupId);
      return [...filtered, ...newBoards];
    });
    setSelectedItemIds([groupId]);
  },
  buildFaceFrame: cfg => {
    const { pushHistory, boards, groups, setBoards, setGroups, setSelectedItemIds, defaultMaterial } = get();
    pushHistory();
    const parseNum = (val, def) => { const n = parseFloat(val); return isNaN(n) ? def : n; };
    const W = parseNum(cfg.width, 24);
    const H = parseNum(cfg.height, 30);
    const t = parseNum(cfg.thickness, 0.75);
    const wStile = parseNum(cfg.stileWidth, 1.5);
    const wRail = parseNum(cfg.railWidth, 1.5);
    const isEditing = !!cfg.editGroupId;
    const groupId = isEditing ? cfg.editGroupId : 'Face Frame ' + Math.floor(Math.random() * 1000);
    const { editGroupId, ...savedParams } = cfg;
    let offset = [
      parseNum(cfg.offsetX, 0),
      parseNum(cfg.offsetY, 0),
      parseNum(cfg.offsetZ, 0)
    ];
    const oldIdMap = {};
    if (isEditing) {
      const childBoards = collectChildBoards(groupId, boards, groups);
      if (childBoards.length > 0) {
        const aabb = computeWorldAABB(childBoards);
        offset = [aabb.minX, aabb.minY, aabb.minZ];
      }
      childBoards.forEach(b => { oldIdMap[b.name] = b.id; });
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

    const railW = W - (2 * wStile);
    const midZ = t / 2;
    const panelDefs = [
      {
        name: 'Left Stile',
        size: [wStile, H, t],
        position: [wStile / 2, H / 2, midZ]
      },
      {
        name: 'Right Stile',
        size: [wStile, H, t],
        position: [W - wStile / 2, H / 2, midZ]
      },
      {
        name: 'Top Rail',
        size: [railW, wRail, t],
        position: [W / 2, H - wRail / 2, midZ]
      },
      {
        name: 'Bottom Rail',
        size: [railW, wRail, t],
        position: [W / 2, wRail / 2, midZ]
      }
    ];

    const baseId = Date.now();
    const newBoards = panelDefs.map((pd, i) => {
      const assignedId = oldIdMap[pd.name] || baseId + i;
      return {
        id: assignedId,
        name: pd.name,
        parentId: groupId,
        size: pd.size,
        position: [pd.position[0] + offset[0], pd.position[1] + offset[1], pd.position[2] + offset[2]],
        material: defaultMaterial,
        joint: 'None',
        shape: 'box',
        operations: [],
        edgeJoints: []
      };
    });

    setBoards(prev => {
      const newBoardIds = new Set(newBoards.map(nb => nb.id));
      const filtered = prev.filter(b => !newBoardIds.has(b.id) && b.parentId !== groupId);
      return [...filtered, ...newBoards];
    });
    setSelectedItemIds([groupId]);
  },
  buildShelving: cfg => {
    const { pushHistory, boards, groups, setBoards, setGroups, setSelectedItemIds, defaultMaterial } = get();
    pushHistory();
    const parseNum = (val, def) => { const n = parseFloat(val); return isNaN(n) ? def : n; };
    const parseIntSafe = (val, def) => { const n = parseInt(val, 10); return isNaN(n) ? def : n; };
    
    const W = parseNum(cfg.width, 30);
    const H = parseNum(cfg.height, 48); // total vertical space to distribute across
    const D = parseNum(cfg.depth, 11);
    const t = parseNum(cfg.thickness, 0.75);
    const count = parseIntSafe(cfg.count, 3);
    const isEditing = !!cfg.editGroupId;
    const groupId = isEditing ? cfg.editGroupId : 'Shelving Unit ' + Math.floor(Math.random() * 1000);
    const { editGroupId, ...savedParams } = cfg;
    
    let offset = [
      parseNum(cfg.offsetX, 0),
      parseNum(cfg.offsetY, 0),
      parseNum(cfg.offsetZ, 0)
    ];
    const oldIdMap = {};
    if (isEditing) {
      const childBoards = collectChildBoards(groupId, boards, groups);
      if (childBoards.length > 0) {
        const aabb = computeWorldAABB(childBoards);
        // We anchor the shelving at its bottom-center
        offset = [aabb.minX, aabb.minY, aabb.minZ];
      }
      childBoards.forEach((b, i) => { oldIdMap[i] = b.id; }); // Map by index since names are identical
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

    const newBoards = [];
    const baseId = Date.now();
    
    // Distribute shelves evenly. 
    // If count=1, it goes in the middle. 
    // If count > 1, we divide the available empty height by (count + 1).
    const availableHeight = H - (count * t);
    const gap = availableHeight / (count + 1);

    for (let i = 0; i < count; i++) {
        // Calculate Y position of the center of this shelf
        const yCenter = gap * (i + 1) + t * i + (t / 2);
        const assignedId = oldIdMap[i] || baseId + i;
        
        newBoards.push({
            id: assignedId,
            name: `Shelf ${i + 1}`,
            parentId: groupId,
            size: [W, t, D],
            position: [W / 2 + offset[0], yCenter + offset[1], D / 2 + offset[2]],
            material: defaultMaterial,
            joint: 'None',
            shape: 'box',
            operations: [],
            edgeJoints: []
        });
    }

    setBoards(prev => {
      const newBoardIds = new Set(newBoards.map(nb => nb.id));
      const filtered = prev.filter(b => !newBoardIds.has(b.id) && b.parentId !== groupId);
      return [...filtered, ...newBoards];
    });
    setSelectedItemIds([groupId]);
  },
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
    const parseNum = (val, def) => {
      if (val === undefined || val === null || val === '') return def;
      const n = parseFloat(val);
      return isNaN(n) ? def : n;
    };
    const W = parseNum(cfg.width, 18);
    const H = parseNum(cfg.height, 30);
    const tFrame = parseNum(cfg.thicknessFrame, 0.75);
    const tPanel = parseNum(cfg.thicknessPanel, 0.25);
    const wStile = parseNum(cfg.widthStileRail, 2);
    const grooveD = parseNum(cfg.grooveDepth, 0.375);
    const grooveW = parseNum(cfg.grooveWidth, 0.25);
    const clear = parseNum(cfg.panelClearance, 0.125);
    const isEditing = !!cfg.editGroupId;
    const groupId = isEditing ? cfg.editGroupId : 'Shaker Door ' + Math.floor(Math.random() * 1000);
    const {
      editGroupId,
      ...savedParams
    } = cfg;
    let offset = [
      parseNum(cfg.offsetX, 0),
      parseNum(cfg.offsetY, 0),
      parseNum(cfg.offsetZ, 0)
    ];
    const oldIdMap = {};
    if (isEditing) {
      const childBoards = collectChildBoards(groupId, boards, groups);
      if (childBoards.length > 0) {
        const aabb = computeWorldAABB(childBoards);
        offset = [aabb.minX, aabb.minY, aabb.minZ];
      }
      childBoards.forEach(b => {
        oldIdMap[b.name] = b.id;
      });
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
    const panelW = W - 2 * wStile + 2 * grooveD - clear;
    const panelH = H - 2 * wStile + 2 * grooveD - clear;
    const railTotalW = W - 2 * wStile + 2 * grooveD;
    const midZ = tFrame / 2;
    const baseId = Date.now();
    const tenonCutDepth = (tFrame - grooveW) / 2;
    const tenonOffsetLeft = -(railTotalW / 2) + grooveD / 2;
    const tenonOffsetRight = railTotalW / 2 - grooveD / 2;
    const makeTenons = idBase => [{
      id: idBase + 1,
      type: 'dado',
      face: 'front',
      direction: 'y',
      width: grooveD,
      depth: tenonCutDepth,
      offset: tenonOffsetLeft,
      length: 0,
      lengthOffset: 0,
      source: 'shaker'
    }, {
      id: idBase + 2,
      type: 'dado',
      face: 'front',
      direction: 'y',
      width: grooveD,
      depth: tenonCutDepth,
      offset: tenonOffsetRight,
      length: 0,
      lengthOffset: 0,
      source: 'shaker'
    }, {
      id: idBase + 3,
      type: 'dado',
      face: 'back',
      direction: 'y',
      width: grooveD,
      depth: tenonCutDepth,
      offset: tenonOffsetLeft,
      length: 0,
      lengthOffset: 0,
      source: 'shaker'
    }, {
      id: idBase + 4,
      type: 'dado',
      face: 'back',
      direction: 'y',
      width: grooveD,
      depth: tenonCutDepth,
      offset: tenonOffsetRight,
      length: 0,
      lengthOffset: 0,
      source: 'shaker'
    }];
    const panelDefs = [{
      name: 'Left Stile',
      size: [wStile, H, tFrame],
      position: [wStile / 2, H / 2, midZ],
      operations: [{
        id: baseId + 10,
        type: 'dado',
        face: 'right',
        direction: 'y',
        width: grooveW,
        depth: grooveD,
        offset: 0,
        length: 0,
        lengthOffset: 0,
        source: 'shaker'
      }]
    }, {
      name: 'Right Stile',
      size: [wStile, H, tFrame],
      position: [W - wStile / 2, H / 2, midZ],
      operations: [{
        id: baseId + 20,
        type: 'dado',
        face: 'left',
        direction: 'y',
        width: grooveW,
        depth: grooveD,
        offset: 0,
        length: 0,
        lengthOffset: 0,
        source: 'shaker'
      }]
    }, {
      name: 'Top Rail',
      size: [railTotalW, wStile, tFrame],
      position: [W / 2, H - wStile / 2, midZ],
      operations: [{
        id: baseId + 30,
        type: 'dado',
        face: 'bottom',
        direction: 'x',
        width: grooveW,
        depth: grooveD,
        offset: 0,
        length: 0,
        lengthOffset: 0,
        source: 'shaker'
      }, ...makeTenons(baseId + 30)]
    }, {
      name: 'Bottom Rail',
      size: [railTotalW, wStile, tFrame],
      position: [W / 2, wStile / 2, midZ],
      operations: [{
        id: baseId + 40,
        type: 'dado',
        face: 'top',
        direction: 'x',
        width: grooveW,
        depth: grooveD,
        offset: 0,
        length: 0,
        lengthOffset: 0,
        source: 'shaker'
      }, ...makeTenons(baseId + 40)]
    }, {
      name: 'Panel',
      size: [panelW, panelH, tPanel],
      position: [W / 2, H / 2, midZ],
      operations: []
    }];
    const newBoards = panelDefs.map((pd, i) => {
      const assignedId = oldIdMap[pd.name] || baseId + 100 + i;
      return {
        id: assignedId,
        name: pd.name,
        parentId: groupId,
        size: pd.size,
        position: [pd.position[0] + offset[0], pd.position[1] + offset[1], pd.position[2] + offset[2]],
        material: defaultMaterial,
        joint: 'None',
        shape: 'box',
        operations: pd.operations,
        edgeJoints: []
      };
    });
    setBoards(prev => {
      const newBoardIds = new Set(newBoards.map(nb => nb.id));
      const filtered = prev.filter(b => !newBoardIds.has(b.id) && b.parentId !== groupId);
      return [...filtered, ...newBoards];
    });
    setSelectedItemIds([groupId]);
  },
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
    const parseNum = (val, def) => {
      if (val === undefined || val === null || val === '') return def;
      const n = parseFloat(val);
      return isNaN(n) ? def : n;
    };
    const W = parseNum(cfg.width, 24);
    const H = parseNum(cfg.height, 30);
    const Dval = parseNum(cfg.depth, 20);
    const count = parseInt(cfg.count ?? 3, 10);
    const slideWidth = parseNum(cfg.slideWidth, 0.5);
    const verticalGap = parseNum(cfg.verticalGap, 0.125);
    const topClearance = parseNum(cfg.topClearance, 1.0);
    const tBox = parseNum(cfg.thicknessBox, 0.5);
    const tBot = parseNum(cfg.thicknessBottom, 0.25);
    const tFace = parseNum(cfg.thicknessFace, 0.75);
    const faceStyle = cfg.faceStyle ?? 'inset';
    const overlayAmount = parseNum(cfg.overlayAmount, 0.5);
    const jointType = cfg.jointType ?? 'butt';
    const isEditing = !!cfg.editGroupId;
    const rootGroupId = isEditing ? cfg.editGroupId : 'Drawers ' + Math.floor(Math.random() * 1000);
    const {
      editGroupId,
      ...savedParams
    } = cfg;
    let offset = [
      parseNum(cfg.offsetX, 0),
      parseNum(cfg.offsetY, 0),
      parseNum(cfg.offsetZ, 0)
    ];
    let rootParent = 'Workspace';
    const oldIdMap = {};
    if (isEditing) {
      const childBoards = collectChildBoards(rootGroupId, boards, groups);
      if (childBoards.length > 0) {
        const aabb = computeWorldAABB(childBoards);
        offset = [aabb.minX, aabb.minY, aabb.minZ];
      }
      rootParent = groups[rootGroupId]?.parentId || 'Workspace';
      childBoards.forEach(b => {
        const parts = b.parentId.split(' ');
        const drawerNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(drawerNum)) {
          const drawerIndex = drawerNum - 1;
          oldIdMap[drawerIndex + '_' + b.name] = b.id;
        }
      });
    }
    const newBoards = [];
    const newGroups = {};
    if (!isEditing) {
      newGroups[rootGroupId] = {
        parentId: rootParent,
        isExpanded: true,
        visible: true,
        meta: {
          builder: 'drawerStack',
          params: savedParams
        }
      };
    } else {
      newGroups[rootGroupId] = {
        ...groups[rootGroupId],
        meta: {
          builder: 'drawerStack',
          params: savedParams
        }
      };
    }
    const slotH = (H - (count - 1) * verticalGap) / count;
    let boxD = Dval;
    let faceW = W;
    let faceX = W / 2;
    let faceZ = Dval;
    if (faceStyle === 'inset') {
      boxD = Dval - tFace;
      faceZ = Dval - tFace / 2;
    } else {
      faceW = W + 2 * overlayAmount;
      faceX = W / 2;
      faceZ = Dval + tFace / 2;
    }
    const boxW = W - 2 * slideWidth;
    const boxH = slotH - topClearance;
    let baseId = Date.now();
    for (let i = 0; i < count; i++) {
      const drawerGroupId = rootGroupId + ' Drawer ' + (i + 1);
      newGroups[drawerGroupId] = {
        parentId: rootGroupId,
        isExpanded: false,
        visible: true
      };
      const currentY = i * (slotH + verticalGap);
      const boxCenterY = currentY + boxH / 2;
      const faceCenterY = currentY + slotH / 2;
      let fW = boxW;
      if (jointType === 'butt') {
        fW = boxW - 2 * tBox;
      } else if (jointType === 'rabbet') {
        // Drawer Lock Joint: front is shorter so sides overlap it.
        fW = boxW - tBox;
      }
      const bLeft = {
        id: oldIdMap[i + '_Box Left'] || baseId++,
        name: `Box Left`,
        parentId: drawerGroupId,
        size: [tBox, boxH, boxD],
        position: [slideWidth + tBox / 2, boxCenterY, boxD / 2]
      };
      const bRight = {
        id: oldIdMap[i + '_Box Right'] || baseId++,
        name: `Box Right`,
        parentId: drawerGroupId,
        size: [tBox, boxH, boxD],
        position: [W - slideWidth - tBox / 2, boxCenterY, boxD / 2]
      };
      const bFront = {
        id: oldIdMap[i + '_Box Front'] || baseId++,
        name: `Box Front`,
        parentId: drawerGroupId,
        size: [fW, boxH, tBox],
        position: [W / 2, boxCenterY, boxD - tBox / 2]
      };
      const bBack = {
        id: oldIdMap[i + '_Box Back'] || baseId++,
        name: `Box Back`,
        parentId: drawerGroupId,
        size: [fW, boxH, tBox],
        position: [W / 2, boxCenterY, tBox / 2]
      };
      const bBot = {
        id: oldIdMap[i + '_Box Bottom'] || baseId++,
        name: `Box Bottom`,
        parentId: drawerGroupId,
        size: [boxW - tBox, tBot, boxD - tBox],
        position: [W / 2, currentY + 0.5 + tBot / 2, boxD / 2]
      };
      let specificFaceH = slotH + verticalGap;
      let specificFaceY = faceCenterY;
      if (faceStyle === 'overlay') {
        if (count === 1) {
          specificFaceH = slotH + 2 * overlayAmount;
        } else if (i === 0) {
          specificFaceH = slotH + overlayAmount + verticalGap / 2;
          specificFaceY = currentY + slotH / 2 - overlayAmount / 2 + verticalGap / 4;
        } else if (i === count - 1) {
          specificFaceH = slotH + overlayAmount + verticalGap / 2;
          specificFaceY = currentY + slotH / 2 + overlayAmount / 2 - verticalGap / 4;
        }
      } else {
        specificFaceH = slotH;
      }
      const bFace = {
        id: oldIdMap[i + '_Face'] || baseId++,
        name: `Face`,
        parentId: drawerGroupId,
        size: [faceW, specificFaceH, tFace],
        position: [faceX, specificFaceY, faceZ]
      };

      // Corner Joints
      if (jointType === 'rabbet') {
        const cornerDepth = tBox / 2;
        const cornerWidth = tBox / 2;
        const fOffset = fW / 2 - tBox / 4;
        const sOffset = boxD / 2 - tBox / 4;

        // Front board gets rabbets on the inside (back face)
        const fRabL = {
          type: 'dado',
          width: cornerWidth,
          depth: cornerDepth,
          offset: -fOffset,
          length: 0,
          lengthOffset: 0,
          source: 'edge-joint',
          partnerId: bLeft.id.toString(),
          face: 'back',
          direction: 'y'
        };
        const fRabR = {
          type: 'dado',
          width: cornerWidth,
          depth: cornerDepth,
          offset: fOffset,
          length: 0,
          lengthOffset: 0,
          source: 'edge-joint',
          partnerId: bRight.id.toString(),
          face: 'back',
          direction: 'y'
        };
        bFront.operations = [{
          ...fRabL,
          id: Date.now() + Math.random()
        }, {
          ...fRabR,
          id: Date.now() + Math.random()
        }];

        // Back board gets rabbets on the inside (front face)
        const bRabL = {
          type: 'dado',
          width: cornerWidth,
          depth: cornerDepth,
          offset: -fOffset,
          length: 0,
          lengthOffset: 0,
          source: 'edge-joint',
          partnerId: bLeft.id.toString(),
          face: 'front',
          direction: 'y'
        };
        const bRabR = {
          type: 'dado',
          width: cornerWidth,
          depth: cornerDepth,
          offset: fOffset,
          length: 0,
          lengthOffset: 0,
          source: 'edge-joint',
          partnerId: bRight.id.toString(),
          face: 'front',
          direction: 'y'
        };
        bBack.operations = [{
          ...bRabL,
          id: Date.now() + Math.random()
        }, {
          ...bRabR,
          id: Date.now() + Math.random()
        }];

        // Left board gets rabbets on the inside (right face)
        const lRabF = {
          type: 'dado',
          width: cornerWidth,
          depth: cornerDepth,
          offset: sOffset,
          length: 0,
          lengthOffset: 0,
          source: 'edge-joint',
          partnerId: bFront.id.toString(),
          face: 'right',
          direction: 'y'
        };
        const lRabB = {
          type: 'dado',
          width: cornerWidth,
          depth: cornerDepth,
          offset: -sOffset,
          length: 0,
          lengthOffset: 0,
          source: 'edge-joint',
          partnerId: bBack.id.toString(),
          face: 'right',
          direction: 'y'
        };
        bLeft.operations = [{
          ...lRabF,
          id: Date.now() + Math.random()
        }, {
          ...lRabB,
          id: Date.now() + Math.random()
        }];

        // Right board gets rabbets on the inside (left face)
        const rRabF = {
          type: 'dado',
          width: cornerWidth,
          depth: cornerDepth,
          offset: sOffset,
          length: 0,
          lengthOffset: 0,
          source: 'edge-joint',
          partnerId: bFront.id.toString(),
          face: 'left',
          direction: 'y'
        };
        const rRabB = {
          type: 'dado',
          width: cornerWidth,
          depth: cornerDepth,
          offset: -sOffset,
          length: 0,
          lengthOffset: 0,
          source: 'edge-joint',
          partnerId: bBack.id.toString(),
          face: 'left',
          direction: 'y'
        };
        bRight.operations = [{
          ...rRabF,
          id: Date.now() + Math.random()
        }, {
          ...rRabB,
          id: Date.now() + Math.random()
        }];
      }
      const drawerBoards = [bLeft, bRight, bFront, bBack, bBot, bFace].map(b => ({
        ...b,
        position: [b.position[0] + offset[0], b.position[1] + offset[1], b.position[2] + offset[2]],
        material: defaultMaterial,
        joint: 'None',
        shape: 'box',
        operations: b.operations || [],
        edgeJoints: b.edgeJoints || []
      }));

      // Dado the bottom
      const dL = drawerBoards[0];
      const dR = drawerBoards[1];
      const dF = drawerBoards[2];
      const dB = drawerBoards[3];
      const dBot = drawerBoards[4];

      // Dado depth is usually half the thickness of the box side
      const dadoDepth = tBox / 2;
      const dadoOffset = 0.5 + tBot / 2 - boxH / 2; // Y offset from center of side board

      const dadoOp = {
        type: 'dado',
        width: tBot,
        depth: dadoDepth,
        offset: dadoOffset,
        length: 0,
        lengthOffset: 0,
        source: 'edge-joint',
        partnerId: dBot.id.toString()
      };
      dL.operations.push({
        ...dadoOp,
        id: Date.now() + Math.random(),
        face: 'right',
        direction: 'z'
      });
      dR.operations.push({
        ...dadoOp,
        id: Date.now() + Math.random(),
        face: 'left',
        direction: 'z'
      });
      dF.operations.push({
        ...dadoOp,
        id: Date.now() + Math.random(),
        face: 'back',
        direction: 'x'
      });
      dB.operations.push({
        ...dadoOp,
        id: Date.now() + Math.random(),
        face: 'front',
        direction: 'x'
      });
      [dL, dR, dF, dB].forEach(side => {
        side.edgeJoints = [{
          partnerId: dBot.id.toString(),
          type: 'dado',
          overBoardId: side.id.toString()
        }];
        dBot.edgeJoints = dBot.edgeJoints || [];
        dBot.edgeJoints.push({
          partnerId: side.id.toString(),
          type: 'dado',
          overBoardId: side.id.toString()
        });
      });
      newBoards.push(...drawerBoards);
    }
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