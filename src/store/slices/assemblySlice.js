import { computeWorldAABB, collectChildBoards } from '../../utils/sceneGraph';
import { applySmartFastenersHelper } from '../../utils/assemblyFasteners';
import { cloneAssemblyHelper } from '../../utils/assemblyCloner';
import {
  applyAssemblyProfileHelper,
  clearAssemblyProfileHelper
} from '../../utils/assemblyProfiler';
import {
  buildCabinetHelper,
  buildBoxHelper,
  buildFaceFrameHelper,
  buildShelvingHelper,
  buildShakerDoorHelper,
  buildDrawersHelper,
  buildTableBaseHelper,
  buildTableTopHelper
} from '../../utils/proceduralUpdaters';

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
    const { newBoards, newGroups, newConstraints, newRootId } = cloneAssemblyHelper(selectedGroupId, boards, groups, constraints);
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
    showToast(`Cloned "${selectedGroupId}"`);
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
        setBoards(prev => prev
          .filter(bd => !allBoardIdsToDel.has(bd.id))
          .map(bd => {
            if (bd.operations && bd.operations.length > 0) {
              const cleanedOps = bd.operations.filter(op => !allGroupIdsToDel.has(op.parentGroupId));
              if (cleanedOps.length !== bd.operations.length) {
                return { ...bd, operations: cleanedOps };
              }
            }
            return bd;
          })
        );
        setSelectedItemIds(prev => prev.filter(id => !allBoardIdsToDel.has(parseInt(id)) && !allGroupIdsToDel.has(id)));
        setConfirmDialog(null);
      }
    });
  },
  // ─── Cabinet Builder ──────────────────────────────────────────────────────
  buildCabinet: cfg => {
    const { pushHistory, boards, groups, setBoards, setGroups, setSelectedItemIds, addRecordedStep } = get();
    pushHistory();
    const res = buildCabinetHelper(cfg, boards, groups);
    setGroups(res.updatedGroups);
    setBoards(res.updatedBoards);
    setSelectedItemIds([res.groupId]);

    if (addRecordedStep) {
      addRecordedStep(
        `Click **Builders** in the header drawer.\n` +
        `Click the **Cabinet Builder** icon and set the outer properties:\n` +
        `*   **Width (X):** \`${cfg.width}"\`\n` +
        `*   **Height (Y):** \`${cfg.height}"\`\n` +
        `*   **Depth (Z):** \`${cfg.depth}"\`\n` +
        `*   **Back Style:** \`${cfg.backStyle || 'flat'}\`\n` +
        `Click **Build Cabinet** to generate the nested assembly.`
      );
    }

    setTimeout(() => {
      const { setBoards } = get();
      if (res.backStyle === 'inset') {
        setTimeout(() => {
          const backIdStr = res.newBoards[4].id.toString();
          const tSide = res.tSide;
          const tTB = res.tTB;
          const tBack = res.tBack;
          const bottomId = res.newBoards[0].id;
          const topId = res.newBoards[1].id;
          const leftId = res.newBoards[2].id;
          const rightId = res.newBoards[3].id;
          setBoards(prev => prev.map(b => {
            if (['Bottom', 'Top', 'Left Side', 'Right Side'].includes(b.name) && b.parentId === res.groupId) {
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
              return { ...b, edgeJoints: [...(b.edgeJoints || []), joint] };
            }
            if (b.name === 'Back' && b.parentId === res.groupId) {
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
              return { ...b, edgeJoints: [...(b.edgeJoints || []), ...newJoints] };
            }
            return b;
          }));
        }, 10);
      }
    }, 10);
  },
  // ─── Box Builder ──────────────────────────────────────────────────────────
  buildBox: cfg => {
    const { pushHistory, boards, groups, setBoards, setGroups, setSelectedItemIds, addRecordedStep } = get();
    pushHistory();
    const res = buildBoxHelper(cfg, boards, groups);
    setGroups(res.updatedGroups);
    setBoards(res.updatedBoards);
    setSelectedItemIds([res.groupId]);

    if (addRecordedStep) {
      addRecordedStep(
        `Click **Builders** in the header drawer.\n` +
        `Click the **Box Builder** icon and set the outer properties:\n` +
        `*   **Width (X):** \`${cfg.width}"\`\n` +
        `*   **Height (Y):** \`${cfg.height}"\`\n` +
        `*   **Depth (Z):** \`${cfg.depth}"\`\n` +
        `*   **Box Style:** \`${cfg.style || 'five-panel'}\`\n` +
        `Click **Build Box** to generate the assembly.`
      );
    }
  },
  // ─── Face Frame Builder ───────────────────────────────────────────────────
  buildFaceFrame: cfg => {
    const { pushHistory, boards, groups, setBoards, setGroups, setSelectedItemIds, defaultMaterial, addRecordedStep } = get();
    pushHistory();
    const res = buildFaceFrameHelper(cfg, boards, groups, defaultMaterial);
    setGroups(res.updatedGroups);
    setBoards(res.updatedBoards);
    setSelectedItemIds([res.groupId]);

    if (addRecordedStep) {
      addRecordedStep(
        `Click **Builders** in the header drawer.\n` +
        `Click the **Face Frame Builder** icon and set the properties:\n` +
        `*   **Width (X):** \`${cfg.width}"\`\n` +
        `*   **Height (Y):** \`${cfg.height}"\`\n` +
        `*   **Stile Width:** \`${cfg.stileWidth}"\`\n` +
        `*   **Rail Width:** \`${cfg.railWidth}"\`\n` +
        `Click **Build Face Frame**.`
      );
    }
  },
  // ─── Shelving Builder ─────────────────────────────────────────────────────
  buildShelving: cfg => {
    const { pushHistory, boards, groups, setBoards, setGroups, setSelectedItemIds, defaultMaterial, addRecordedStep } = get();
    pushHistory();
    const res = buildShelvingHelper(cfg, boards, groups, defaultMaterial);
    setGroups(res.updatedGroups);
    setBoards(res.updatedBoards);
    setSelectedItemIds([res.groupId]);

    if (addRecordedStep) {
      addRecordedStep(
        `Click **Builders** in the header drawer.\n` +
        `Click the **Shelving Builder** icon and set the properties:\n` +
        `*   **Width (X):** \`${cfg.width}"\`\n` +
        `*   **Height (Y):** \`${cfg.height}"\`\n` +
        `*   **Depth (Z):** \`${cfg.depth}"\`\n` +
        `*   **Shelves Count:** \`${cfg.shelvesCount}\`\n` +
        `Click **Build Shelving**.`
      );
    }
  },
  // ─── Shaker Door Builder ──────────────────────────────────────────────────
  buildShakerDoor: cfg => {
    const { pushHistory, boards, groups, setBoards, setGroups, setSelectedItemIds, defaultMaterial, addRecordedStep } = get();
    pushHistory();
    const res = buildShakerDoorHelper(cfg, boards, groups, defaultMaterial);
    setGroups(res.updatedGroups);
    setBoards(res.updatedBoards);
    setSelectedItemIds([res.groupId]);

    if (addRecordedStep) {
      addRecordedStep(
        `Click **Builders** in the header drawer.\n` +
        `Click the **Shaker Door Builder** icon and set the properties:\n` +
        `*   **Width (X):** \`${cfg.width}"\`\n` +
        `*   **Height (Y):** \`${cfg.height}"\`\n` +
        `*   **Stile Width:** \`${cfg.stileWidth}"\`\n` +
        `*   **Rail Width:** \`${cfg.railWidth}"\`\n` +
        `Click **Build Shaker Door**.`
      );
    }
  },
  // ─── Drawer Stack Builder ─────────────────────────────────────────────────
  buildDrawers: cfg => {
    const { pushHistory, boards, groups, setBoards, setGroups, setSelectedItemIds, defaultMaterial, addRecordedStep } = get();
    pushHistory();
    const res = buildDrawersHelper(cfg, boards, groups, defaultMaterial);
    setGroups(res.updatedGroups);
    setBoards(res.updatedBoards);
    setSelectedItemIds([res.rootGroupId]);

    if (addRecordedStep) {
      addRecordedStep(
        `Click **Builders** in the header drawer.\n` +
        `Click the **Drawer Stack Builder** icon and set the properties:\n` +
        `*   **Width (X):** \`${cfg.width}"\`\n` +
        `*   **Height (Y):** \`${cfg.height}"\`\n` +
        `*   **Depth (Z):** \`${cfg.depth}"\`\n` +
        `*   **Drawers Count:** \`${cfg.drawerCount}\`\n` +
        `Click **Build Drawers**.`
      );
    }
  },
  // ─── Table Base Builder ───────────────────────────────────────────────────
  buildTableBase: cfg => {
    const { pushHistory, boards, groups, setBoards, setGroups, setConstraints, setSelectedItemIds, defaultMaterial, addRecordedStep } = get();
    pushHistory();
    const res = buildTableBaseHelper(cfg, boards, groups, get().constraints, defaultMaterial);
    setGroups(res.updatedGroups);
    setBoards(res.updatedBoards);
    setConstraints(res.updatedConstraints);
    setSelectedItemIds([res.groupId]);

    if (addRecordedStep) {
      addRecordedStep(
        `Click **Builders** in the header drawer.\n` +
        `Click the **Table Base Builder** icon and set the properties:\n` +
        `*   **Width (X):** \`${cfg.width}"\`\n` +
        `*   **Height (Y):** \`${cfg.height}"\`\n` +
        `*   **Depth (Z):** \`${cfg.depth}"\`\n` +
        `*   **Apron Width:** \`${cfg.apronWidth}"\`\n` +
        `Click **Build Table Base**.`
      );
    }
  },
  // ─── Table Top Builder ────────────────────────────────────────────────────
  buildTableTop: cfg => {
    const { pushHistory, boards, groups, setBoards, setGroups, setConstraints, setSelectedItemIds, defaultMaterial, showToast, addRecordedStep } = get();
    pushHistory();
    const res = buildTableTopHelper(cfg, boards, groups, get().constraints, defaultMaterial);
    setGroups(res.updatedGroups);
    setBoards(res.updatedBoards);
    setConstraints(res.updatedConstraints);
    setSelectedItemIds([res.groupId]);

    if (addRecordedStep) {
      addRecordedStep(
        `Click **Builders** in the header drawer.\n` +
        `Click the **Table Top Builder** icon and set the properties:\n` +
        `*   **Width (X):** \`${cfg.width}"\`\n` +
        `*   **Depth (Z):** \`${cfg.depth}"\`\n` +
        `*   **Thickness (Y):** \`${cfg.thickness}"\`\n` +
        `Click **Build Table Top**.`
      );
    }

    // Establish structural rigid glue constraints
    setTimeout(() => {
      const latestBoards = get().boards;
      const topBoards = latestBoards.filter(b => b.parentId === res.groupId);
      
      const newConstraints = {};
      let cIndex = 0;

      // 1. Glue adjacent slats together rigidly so they form a single solid panel
      const topSlats = topBoards.filter(b => b.name.startsWith('Top Slat ')).sort((a, b) => {
        const numA = parseInt(a.name.replace('Top Slat ', ''), 10);
        const numB = parseInt(b.name.replace('Top Slat ', ''), 10);
        return numA - numB;
      });

      for (let i = 0; i < topSlats.length - 1; i++) {
        const slatA = topSlats[i];
        const slatB = topSlats[i + 1];
        const cId = `glue_slat_seam_${Date.now()}_${cIndex++}`;
        newConstraints[cId] = {
          type: 'Glue',
          boardAId: slatA.id.toString(),
          boardBId: slatB.id.toString(),
          offset: [
            slatB.position[0] - slatA.position[0],
            slatB.position[1] - slatA.position[1],
            slatB.position[2] - slatA.position[2]
          ],
          enabled: true
        };
      }

      // 2. Glue procedural fasteners (Dowels/Dominoes) to their corresponding slat
      const proceduralFasteners = topBoards.filter(b => b.name.startsWith('Domino ') || b.name.startsWith('Dowel '));
      proceduralFasteners.forEach(pf => {
        const match = pf.name.match(/[j](\d+)/);
        if (match) {
          const slatIdx = parseInt(match[1], 10);
          const parentSlat = topSlats.find(s => s.name === `Top Slat ${slatIdx}`);
          if (parentSlat) {
            const cId = `glue_procedural_fastener_${Date.now()}_${cIndex++}`;
            newConstraints[cId] = {
              type: 'Glue',
              boardAId: pf.id.toString(),
              boardBId: parentSlat.id.toString(),
              offset: [
                parentSlat.position[0] - pf.position[0],
                parentSlat.position[1] - pf.position[1],
                parentSlat.position[2] - pf.position[2]
              ],
              enabled: true
            };
          }
        }
      });

      // 3. If there is an active base, snap-align and glue table top to base
      if (res.hasBase && res.baseGroupId) {
        const baseBoards = collectChildBoards(res.baseGroupId, latestBoards, get().groups);
        const frontApron = baseBoards.find(b => b.name === 'Apron Front');
        const backApron = baseBoards.find(b => b.name === 'Apron Back');
        const leftApron = baseBoards.find(b => b.name === 'Apron Left');
        const rightApron = baseBoards.find(b => b.name === 'Apron Right');
        const baseStringers = baseBoards.filter(b => b.name.startsWith('Stringer '));

        // Glue first slat to back apron
        const firstSlat = topSlats[0];
        if (firstSlat && backApron) {
          const cId = `glue_top_base_${Date.now()}_${cIndex++}`;
          newConstraints[cId] = {
            type: 'Glue',
            boardAId: firstSlat.id.toString(),
            boardBId: backApron.id.toString(),
            offset: [firstSlat.position[0] - backApron.position[0], firstSlat.position[1] - backApron.position[1], firstSlat.position[2] - backApron.position[2]],
            enabled: true
          };
        }

        // Glue last slat to front apron
        if (topSlats.length > 0 && frontApron) {
          const lastSlat = topSlats[topSlats.length - 1];
          const cId = `glue_top_base_${Date.now()}_${cIndex++}`;
          newConstraints[cId] = {
            type: 'Glue',
            boardAId: lastSlat.id.toString(),
            boardBId: frontApron.id.toString(),
            offset: [lastSlat.position[0] - frontApron.position[0], lastSlat.position[1] - frontApron.position[1], lastSlat.position[2] - frontApron.position[2]],
            enabled: true
          };
        }

        // Glue breadboards to side aprons if present
        const leftBB = topBoards.find(b => b.name === 'Left Breadboard');
        if (leftBB && leftApron) {
          const cId = `glue_top_base_${Date.now()}_${cIndex++}`;
          newConstraints[cId] = {
            type: 'Glue',
            boardAId: leftBB.id.toString(),
            boardBId: leftApron.id.toString(),
            offset: [leftBB.position[0] - leftApron.position[0], leftBB.position[1] - leftApron.position[1], leftBB.position[2] - leftApron.position[2]],
            enabled: true
          };
        }
        const rightBB = topBoards.find(b => b.name === 'Right Breadboard');
        if (rightBB && rightApron) {
          const cId = `glue_top_base_${Date.now()}_${cIndex++}`;
          newConstraints[cId] = {
            type: 'Glue',
            boardAId: rightBB.id.toString(),
            boardBId: rightApron.id.toString(),
            offset: [rightBB.position[0] - rightApron.position[0], rightBB.position[1] - rightApron.position[1], rightBB.position[2] - rightApron.position[2]],
            enabled: true
          };
        }

        // Glue intermediate slats to stringers
        if (baseStringers.length > 0 && topSlats.length > 2) {
          baseStringers.forEach((stringer, sIdx) => {
            const closeSlat = topSlats[Math.min(topSlats.length - 1, Math.max(0, Math.floor(topSlats.length * ((sIdx + 1) / (baseStringers.length + 1)))))];
            if (closeSlat) {
              const cId = `glue_top_base_${Date.now()}_${cIndex++}`;
              newConstraints[cId] = {
                type: 'Glue',
                boardAId: closeSlat.id.toString(),
                boardBId: stringer.id.toString(),
                offset: [closeSlat.position[0] - stringer.position[0], closeSlat.position[1] - stringer.position[1], closeSlat.position[2] - stringer.position[2]],
                enabled: true
              };
            }
          });
        }
      }

      setConstraints(prev => ({ ...prev, ...newConstraints }));
      if (res.hasBase && res.baseGroupId) {
        showToast('✅ Table top snap-aligned on base. Glue constraints generated.');
      } else {
        showToast('✅ Table top generated. Glue constraints created.');
      }
    }, 50);
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
  },

  // ─── Smart Joint Fasteners ──────────────────────────────────────────────────
  applySmartFasteners: (boardAId, boardBId, config) => {
    const {
      boards,
      groups,
      constraints,
      setBoards,
      setGroups,
      setConstraints,
      pushHistory,
      showToast
    } = get();

    const boardA = boards.find(b => b.id.toString() === boardAId.toString());
    const boardB = boards.find(b => b.id.toString() === boardBId.toString());
    if (!boardA || !boardB) return;

    pushHistory();

    const res = applySmartFastenersHelper(boardA, boardB, config, boards, groups, constraints);
    
    setGroups(res.nextGroups);
    setBoards(res.newBoards);
    setConstraints(res.nextConstraints);

    if (!res.success) {
      showToast('⚠️ Boards are not touching flush!');
    } else {
      const fastenerLabel = config.type === 'pocket-hole' ? 'Pocket Holes'
                          : config.type === 'dowels' ? 'Dowel Pins'
                          : config.type === 'loose-tenon' ? 'Loose Tenons (Dominoes)'
                          : 'Wood Screws';
      showToast(`✅ Added ${config.count || 2} ${fastenerLabel}. Rigid glue link created.`);
    }
  },

  removeSmartFasteners: (boardAId, boardBId) => {
    const {
      pushHistory,
      boards,
      setBoards,
      constraints,
      setConstraints,
      groups,
      setGroups,
      showToast
    } = get();

    pushHistory();

    // Remove operations
    let finalBoards = boards.map(b => {
      if (b.id.toString() === boardAId.toString() || b.id.toString() === boardBId.toString()) {
        return {
          ...b,
          operations: (b.operations || []).filter(op => op.source !== 'smart-fastener'),
          edgeJoints: (b.edgeJoints || []).filter(ej => ej.partnerId?.toString() !== (b.id.toString() === boardAId.toString() ? boardBId : boardAId).toString())
        };
      }
      return b;
    });

    // Remove 3D visual entities
    const fastenerGroupPrefix = `fasteners_${boardAId}_${boardBId}`;
    const fastenerGroupPrefixRev = `fasteners_${boardBId}_${boardAId}`;
    finalBoards = finalBoards.filter(b => {
      const pid = b.parentId;
      return pid !== fastenerGroupPrefix && pid !== fastenerGroupPrefixRev;
    });

    // Remove constraint
    const nextConstraints = { ...constraints };
    Object.keys(nextConstraints).forEach(cid => {
      const c = nextConstraints[cid];
      if (
        c.type === 'Glue' &&
        ((c.boardAId?.toString() === boardAId.toString() && c.boardBId?.toString() === boardBId.toString()) ||
         (c.boardAId?.toString() === boardBId.toString() && c.boardBId?.toString() === boardAId.toString()))
      ) {
        delete nextConstraints[cid];
      }
    });

    // Remove groups
    const nextGroups = { ...groups };
    delete nextGroups[fastenerGroupPrefix];
    delete nextGroups[fastenerGroupPrefixRev];

    setGroups(nextGroups);
    setBoards(finalBoards);
    setConstraints(nextConstraints);
    showToast('🗑️ Cleared joint fasteners & rigid constraint.');
  },

  applyAssemblyProfile: (boardIds, faceDirection, profileType, profileParams) => {
    const { boards, groups, setBoards, pushHistory, showToast } = get();
    
    // Resolve boards to profile
    const selectedBoards = boards.filter(b => boardIds.includes(b.id.toString()));
    
    pushHistory();
    
    const res = applyAssemblyProfileHelper(selectedBoards, faceDirection, profileType, profileParams, boards);
    
    if (res.success) {
      setBoards(res.newBoards);
      const label = profileType === 'roundover' 
        ? `1/4" roundover applied to outer top/perimeter edges`
        : `45° chamfer applied to outer top/perimeter edges`;
      showToast(`✅ Assembly profile applied: ${label}`);
    } else {
      showToast('⚠️ No flush candidate faces detected on selected boards.');
    }
  },

  clearAssemblyProfile: (boardIds, faceDirection) => {
    const { boards, setBoards, pushHistory, showToast } = get();
    const selectedBoards = boards.filter(b => boardIds.includes(b.id.toString()));
    
    pushHistory();
    
    const res = clearAssemblyProfileHelper(selectedBoards, faceDirection, boards);
    
    if (res.success) {
      setBoards(res.newBoards);
      showToast(`🗑️ Assembly profile removed from ${faceDirection} edges.`);
    }
  }
});