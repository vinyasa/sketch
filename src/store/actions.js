import { computeWorldAABB, collectChildBoards, calculateGroupAABB } from '../utils/sceneGraph';
import { solveAlignmentConstraint, getConstraintConnectedSet } from '../utils/constraintSolver';
import { calculateProceduralBoxWalls } from '../utils/procedural';

export const createActions = (set, get) => ({

    saveWorkspace: (isNamedSave = false) => {
        const { boards, groups, theme, units, gridSnap, defaultMaterial, showEdges, showDimensions, showBoundingBox, globalBounds, recentFiles, setRecentFiles, showToast } = get();
        let name = "My Design";
        if (recentFiles.length > 0) name = recentFiles[0].name;

        if (isNamedSave) {
            let pName = prompt("Save Project As:", name);
            if (!pName) return;
            name = pName;
        }

        const payload = { boards, groups, theme, units, gridSnap, defaultMaterial, showEdges, showDimensions, showBoundingBox, globalBounds };
        localStorage.setItem('lucey_save_' + name, JSON.stringify(payload));

        let newRecents = recentFiles.filter(r => r.name !== name);
        newRecents.unshift({ name, timestamp: Date.now() });
        if (newRecents.length > 5) newRecents = newRecents.slice(0, 5);
        setRecentFiles(newRecents);
        localStorage.setItem('lucey_recent_files', JSON.stringify(newRecents));

        localStorage.setItem('lucey_save', JSON.stringify(payload));
        showToast(`Saved layout to local storage`);
    },

    loadWorkspace: (name) => {
        const { setBoards, setGroups, setTheme, setUnits, setGridSnap, setDefaultMaterial, setShowEdges, setShowDimensions } = get();
        const key = name ? 'lucey_save_' + name : 'lucey_save';
        const s = localStorage.getItem(key);
        if (s) {
            try {
                const p = JSON.parse(s);
                if (p.boards && p.groups) {
                    setBoards(p.boards);
                    setGroups(p.groups);
                    if (p.theme) setTheme(p.theme);
                    if (p.units) setUnits(p.units);
                    if (p.gridSnap) setGridSnap(p.gridSnap);
                    if (p.defaultMaterial) setDefaultMaterial(p.defaultMaterial);
                    if (p.showEdges !== undefined) setShowEdges(p.showEdges);
                    if (p.showDimensions !== undefined) setShowDimensions(p.showDimensions);
                }
            } catch (e) { }
        } else if (name) {
            alert("Project load failed.");
        }
    },

    exportWorkspace: async () => {
        const { boards, groups, showToast } = get();
        const payload = JSON.stringify({ boards, groups }, null, 2);
        try {
            if ('showSaveFilePicker' in window) {
                const handle = await window.showSaveFilePicker({
                    suggestedName: 'my_design.json',
                    types: [{
                        description: 'Little Lucey Project',
                        accept: { 'application/json': ['.json'] }
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(payload);
                await writable.close();
                showToast("Successfully saved to disk");
            } else {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(payload);
                const dlNode = document.createElement('a');
                dlNode.setAttribute("href", dataStr);
                dlNode.setAttribute("download", "my_design.json");
                dlNode.click();
                showToast("Successfully saved to disk");
            }
        } catch (err) {
            if (err.name !== 'AbortError') showToast("Failed to save file.");
        }
    },

    importWorkspace: (e) => {
        const { setBoards, setGroups, resetHistory } = get();
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const p = JSON.parse(event.target.result);
                if (p.boards && p.groups) {
                    setBoards(p.boards);
                    setGroups(p.groups);
                    resetHistory();
                }
            } catch (e) { alert("Failed to parse project file."); }
        };
        reader.readAsText(file);
        e.target.value = '';
    },

    toggleSelection: (id, isMulti, faceStr = null) => {
        const { constraintTargetMode, setConstraintTargetMode, pushHistory, boards, groups, setBoards, selectedItemIds, setSelectedItemIds } = get();
        const strId = id.toString();

        if (constraintTargetMode && constraintTargetMode.active) {
            if (!faceStr) return;

            if (constraintTargetMode.step === 1) {
                if (strId !== constraintTargetMode.sourceId) return;
                setConstraintTargetMode({ ...constraintTargetMode, step: 2, sourceFace: faceStr });
            } else if (constraintTargetMode.step === 2) {
                if (strId === constraintTargetMode.sourceId) return;
                pushHistory();

                const newConstraint = { type: constraintTargetMode.type, sourceFace: constraintTargetMode.sourceFace, targetId: strId, targetFace: faceStr };

                setBoards(prev => prev.map(b => {
                    if (b.id.toString() === constraintTargetMode.sourceId) {
                        let finalTransforms = {};
                        if (constraintTargetMode.type === 'Flush' || constraintTargetMode.type === 'Glue') {
                            const result = solveAlignmentConstraint(b, newConstraint, prev, groups);
                            if (result) finalTransforms = result;
                        }
                        return {
                            ...b,
                            ...finalTransforms,
                            constraints: [...(b.constraints || []), newConstraint]
                        };
                    }
                    return b;
                }));
                setConstraintTargetMode(null);
            }
            return;
        }

        if (isMulti) {
            setSelectedItemIds(prev => prev.includes(strId) ? prev.filter(x => x !== strId) : [...prev, strId]);
        } else {
            setSelectedItemIds([strId]);
        }
    },

    updateSelectedBoards: (key, value) => {
        const { pushHistory, setBoards, boards, selectedItemIds } = get();
        pushHistory();
        setBoards(boards.map(b => selectedItemIds.includes(b.id.toString()) ? { ...b, [key]: value } : b));
    },

    toggleBoardVisibility: (id) => {
        const { setBoards } = get();
        setBoards(bds => bds.map(b => b.id === id ? { ...b, visible: b.visible === false ? true : false } : b));
    },

    toggleGroupVisibility: (groupId) => {
        const { setGroups } = get();
        setGroups(prev => {
            const cur = prev[groupId] || {};
            return { ...prev, [groupId]: { ...cur, visible: cur.visible === false ? true : false } };
        });
    },

    // ─── Update a vector field (size or position) on selected boards ─────────
    updateVector: (key, index, value) => {
        const { selectedItemIds, pushHistory, boards, setBoards } = get();
        if (selectedItemIds.length === 0) return;
        pushHistory();

        const floatVal = parseFloat(value) || 0;

        let movingIds = new Set(selectedItemIds);
        if (key === 'position') {
            movingIds = getConstraintConnectedSet(selectedItemIds, boards);
        }

        setBoards(boards.map(b => {
            if (movingIds.has(b.id.toString())) {
                if (key === 'position') {
                    const primaryBoard = boards.find(bd => selectedItemIds.includes(bd.id.toString()));
                    if (primaryBoard) {
                        const delta = floatVal - primaryBoard[key][index];
                        let newVec = [...b[key]];
                        newVec[index] += delta;
                        return { ...b, [key]: newVec };
                    }
                } else if (selectedItemIds.includes(b.id.toString())) {
                    let newVec = [...b[key]];
                    newVec[index] = floatVal;
                    return { ...b, [key]: newVec };
                }
            }
            return b;
        }));
    },

    // ─── Move all boards in a group by a delta ───────────────────────────────
    moveGroup: (groupId, axis, delta) => {
        const { pushHistory, boards, groups, setBoards } = get();
        if (delta === 0) return;
        pushHistory();

        // Collect all boards in this group and its children
        const childBoards = collectChildBoards(groupId, boards, groups);
        const childIds = new Set(childBoards.map(b => b.id.toString()));

        // Also find externally-constrained boards
        let allMovingIds = new Set(childIds);
        let changed = true;
        while (changed) {
            changed = false;
            boards.forEach(b => {
                const bid = b.id.toString();
                if (allMovingIds.has(bid)) return;
                if (b.constraints && b.constraints.some(c => c.enabled !== false && allMovingIds.has(c.targetId.toString()))) {
                    allMovingIds.add(bid);
                    changed = true;
                }
            });
            boards.forEach(b => {
                const bid = b.id.toString();
                if (!allMovingIds.has(bid)) return;
                if (b.constraints) {
                    b.constraints.forEach(c => {
                        const tid = c.targetId.toString();
                        if (c.enabled !== false && !allMovingIds.has(tid)) {
                            allMovingIds.add(tid);
                            changed = true;
                        }
                    });
                }
            });
        }

        setBoards(prev => prev.map(b => {
            if (allMovingIds.has(b.id.toString())) {
                let newPos = [...b.position];
                newPos[axis] += delta;
                return { ...b, position: newPos };
            }
            return b;
        }));
    },

    updateProceduralBox: (groupId, metaUpdates) => {
        const { pushHistory, groups, boards, setGroups, setBoards } = get();
        const curGroup = groups[groupId];
        if (!curGroup || !curGroup.meta || curGroup.meta.type !== 'procedural-box') return;
        pushHistory();

        const newMeta = { ...curGroup.meta, ...metaUpdates };
        setGroups(prev => ({ ...prev, [groupId]: { ...prev[groupId], meta: newMeta } }));

        // Compute offset: procedural box walls are centered at the group's footprint
        // We need the center position of the group's existing boards to reposition
        const existingBoards = boards.filter(b => b.parentId === groupId);
        let offsetX = 0, offsetZ = 0;
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
                        position: [
                            mappedData.position[0] + offsetX,
                            mappedData.position[1],
                            mappedData.position[2] + offsetZ
                        ]
                    };
                }
            }
            return b;
        }));
    },

    // ─── AI Command Processor ────────────────────────────────────────────────
    processAiCommand: (text) => {
        const { pushHistory, selectedItemIds, setBoards, setGroups, setSelectedItemIds, boards, groups, defaultMaterial, globalBounds, setChatMessages } = get();
        pushHistory();
        const lower = text.toLowerCase();
        let reply = "I've processed your request.";
        let updated = false;

        // ── Material change ──────────────────────────────────────────────────
        if (lower.includes('walnut') || lower.includes('pine') || lower.includes('cherry') || lower.includes('oak')) {
            const mat = ['walnut', 'pine', 'cherry', 'red-oak', 'white-oak'].find(m => lower.includes(m.replace('-', ' '))) || 'walnut';
            setBoards(prev => prev.map(b => (selectedItemIds.length > 0 ? (selectedItemIds.includes(b.id.toString()) ? { ...b, material: mat } : b) : { ...b, material: mat })));
            reply = selectedItemIds.length > 0 ? `Changed selected to ${mat}.` : `Changed all to ${mat}.`;
            updated = true;

        // ── Move / Nudge (color-based or directional) ────────────────────────
        } else if ((lower.includes('nudge') || lower.includes('move')) && selectedItemIds.length > 0) {
            // Determine axis from color names or direction words
            let axis = 1; // default: Y (green/up)
            if (lower.includes('red') || lower.includes('left') || lower.includes('right') || /\bx\b/.test(lower)) axis = 0;
            if (lower.includes('blue') || lower.includes('forward') || lower.includes('back') || /\bz\b/.test(lower)) axis = 2;
            if (lower.includes('green') || lower.includes('up') || lower.includes('down') || /\by\b/.test(lower)) axis = 1;

            let val = 1;
            if (lower.includes('down') || lower.includes('left') || lower.includes('back')) val = -1;

            const match = lower.match(/([+-]?\d*\.?\d+)/);
            if (match) val = parseFloat(match[1]) * (val < 0 ? -1 : 1);

            const movingIds = getConstraintConnectedSet(selectedItemIds, boards);

            setBoards(prev => prev.map(b => {
                if (movingIds.has(b.id.toString())) {
                    let newPos = [...b.position];
                    newPos[axis] += val;
                    return { ...b, position: newPos };
                }
                return b;
            }));

            const axisName = ['red (X)', 'green (Y)', 'blue (Z)'][axis];
            reply = `Moved ${movingIds.size} component(s) by ${val}" along ${axisName}.`;
            updated = true;

        // ── Add leg ──────────────────────────────────────────────────────────
        } else if (lower.includes('add') && lower.includes('leg')) {
            const newId = Date.now();
            setBoards(prev => [...prev, { id: newId, name: 'New Leg', parentId: 'Workspace', size: [1.5, 12, 1.5], position: [0, 6, 0], material: defaultMaterial, joint: 'Butt 1', constraints: [] }]);
            setSelectedItemIds([newId.toString()]);
            reply = `Added a new 1.5×12×1.5 leg at origin, sitting on floor.`;
            updated = true;

        // ── Add top ──────────────────────────────────────────────────────────
        } else if (lower.includes('top') && (lower.includes('add') || lower.includes('put'))) {
            let targets = [];
            if (selectedItemIds.length === 0 || selectedItemIds.includes('Workspace')) {
                targets = boards;
            } else {
                const validBoards = new Set();
                const traverse = (pId) => {
                    boards.filter(b => b.parentId === pId).forEach(b => validBoards.add(b));
                    Object.keys(groups).filter(k => groups[k].parentId === pId).forEach(k => traverse(k));
                };
                selectedItemIds.forEach(id => {
                    if (Object.keys(groups).includes(id)) {
                        traverse(id);
                    } else {
                        const b = boards.find(x => x.id.toString() === id);
                        if (b) validBoards.add(b);
                    }
                });
                targets = Array.from(validBoards);
            }

            if (targets.length === 0) {
                reply = "I need some existing geometry to calculate where a top should go!";
            } else {
                const aabb = computeWorldAABB(targets);
                let newWidth = Math.abs(aabb.maxX - aabb.minX);
                let newDepth = Math.abs(aabb.maxZ - aabb.minZ);
                const thickness = 0.75;

                if (newWidth < 3) newWidth = Math.max(newWidth, 24);
                if (newDepth < 3) newDepth = Math.max(newDepth, 16);

                const newX = (aabb.minX + aabb.maxX) / 2;
                const newZ = (aabb.minZ + aabb.maxZ) / 2;
                const newY = aabb.maxY + thickness / 2;

                const newId = Date.now();
                const pId = targets[0]?.parentId || 'Workspace';

                setBoards(prev => [...prev, {
                    id: newId, name: 'Table Top', parentId: pId,
                    size: [newWidth, thickness, newDepth],
                    position: [newX, newY, newZ],
                    material: defaultMaterial,
                    joint: 'None', constraints: []
                }]);
                setSelectedItemIds([newId.toString()]);
                reply = `Generated top at Y=${newY.toFixed(2)}".`;
                updated = true;
            }

        // ── Build box ────────────────────────────────────────────────────────
        } else if (/(build|create|make).+box/i.test(lower)) {
            let newWidth = 24, newDepth = 16;
            const thickness = 0.75;
            let newHeight = 12;
            let newX = 0, newZ = 0, baseY = 0;

            const hMatch = lower.match(/(\d*\.?\d+)\s*(?:inch|in|"|'')\s*(tall|high|deep|box)/i);
            if (hMatch && hMatch[1]) {
                newHeight = parseFloat(hMatch[1]);
            }

            if (/(bounding box|workspace box|workspace bounds|global bounds)/.test(lower) && globalBounds && globalBounds.enabled) {
                newWidth = globalBounds.x;
                newDepth = globalBounds.z;
            }

            const proceduralMeta = {
                type: 'procedural-box',
                w: newWidth, h: newHeight, d: newDepth, t: thickness,
                joint: 'butt-A'
            };

            const newGroupId = 'Assembly ' + Math.floor(Math.random() * 1000);

            setGroups(prev => ({
                ...prev,
                [newGroupId]: {
                    parentId: 'Workspace',
                    isExpanded: true,
                    visible: true,
                    meta: proceduralMeta
                }
            }));

            const wallsData = calculateProceduralBoxWalls(proceduralMeta);
            const newBoards = wallsData.map((wd, i) => ({
                id: Date.now() + i,
                name: `${wd.role} Wall`,
                parentId: newGroupId,
                size: wd.size,
                position: [wd.position[0] + newX, wd.position[1] + baseY, wd.position[2] + newZ],
                material: defaultMaterial,
                joint: 'None',
                constraints: []
            }));

            setBoards(prev => [...prev, ...newBoards]);
            setSelectedItemIds([newGroupId]);
            reply = `Generated ${newHeight}" box (${newWidth}×${newDepth}) sitting on floor.`;
            updated = true;

        // ── Resize (cut/add/length/width/thickness) ──────────────────────────
        } else if (/(cut|add|trim|extend|shave|chop|short|long|wide|narrow|thick|thin|reduce|increase|shrink|grow|length|width|thickness|decrease|wider|thicker|longer)/.test(lower)) {
            const match = lower.match(/(\d*\.?\d+)/);
            if (match) {
                const val = parseFloat(match[1]);
                const isNegative = /(cut|trim|shave|chop|short|narrow|thin|reduce|shrink|decrease)/.test(lower);
                const delta = isNegative ? -val : val;

                const isLength = /(short|long|length|tall|longer)/.test(lower);
                const isWidth = /(wide|narrow|width|wider)/.test(lower);
                const isThickness = /(thick|thin|thicker|thinner|thickness)/.test(lower);

                let targetedBoards = selectedItemIds.length > 0 ? boards.filter(b => selectedItemIds.includes(b.id.toString())) : [];

                if (targetedBoards.length === 0) {
                    targetedBoards = boards.filter(b => lower.includes(b.name.toLowerCase()));
                }

                if (targetedBoards.length > 0) {
                    const targetIds = targetedBoards.map(b => b.id.toString());

                    setBoards(prev => prev.map(b => {
                        if (targetIds.includes(b.id.toString())) {
                            // Sort dimensions to find length (biggest), width (middle), thickness (smallest)
                            let dims = [
                                { idx: 0, val: b.size[0] },
                                { idx: 1, val: b.size[1] },
                                { idx: 2, val: b.size[2] }
                            ];
                            dims.sort((a, c) => c.val - a.val);

                            let targetIndex;
                            if (isLength) targetIndex = dims[0].idx;        // longest
                            else if (isWidth) targetIndex = dims[1].idx;    // middle
                            else if (isThickness) targetIndex = dims[2].idx; // smallest
                            else {
                                // Directional: check for axis-specific words
                                if (/(right|left)/.test(lower) || lower.includes('red') || /\bx\b/.test(lower)) targetIndex = 0;
                                else if (/(up|down|top|bottom)/.test(lower) || lower.includes('green') || /\by\b/.test(lower)) targetIndex = 1;
                                else if (/(front|back)/.test(lower) || lower.includes('blue') || /\bz\b/.test(lower)) targetIndex = 2;
                                else targetIndex = dims[2].idx; // default: thickness
                            }

                            let newSize = [...b.size];
                            const actualDelta = Math.max(0.1 - newSize[targetIndex], delta);
                            newSize[targetIndex] += actualDelta;

                            return { ...b, size: newSize };
                        }
                        return b;
                    }));

                    const dimLabel = isLength ? 'length' : isWidth ? 'width' : 'thickness';
                    reply = `Adjusted ${dimLabel} of ${targetIds.length} component(s) by ${delta > 0 ? '+' : ''}${delta}".`;
                    updated = true;
                } else {
                    reply = "I don't know which board to resize! Please select a component or say its name.";
                    updated = true;
                }
            } else {
                reply = "I didn't detect a number! Try 'make this 1 inch wider'.";
                updated = true;
            }
        }

        if (!updated) {
            reply = "I need clearer instructions. Try 'move this 3 along red' or 'make this 1 inch wider'.";
        }

        setTimeout(() => {
            get().setChatMessages(prev => [...prev, { role: 'ai', text: reply }]);
        }, 500);
    },

    submitChat: () => {
        const { chatInput, setChatMessages, setChatInput } = get();
        if (chatInput.trim()) {
            setChatMessages(prev => [...prev, { role: 'user', text: chatInput }]);
            get().processAiCommand(chatInput);
            setChatInput('');
        }
    },

    handleDragStart: (e, id, type) => {
        e.dataTransfer.setData('drag_id', id);
        e.dataTransfer.setData('drag_type', type);
        e.stopPropagation();
    },

    handleDrop: (e, newParentId) => {
        const { pushHistory, setBoards, setGroups } = get();
        e.preventDefault();
        e.stopPropagation();
        const id = e.dataTransfer.getData('drag_id');
        const type = e.dataTransfer.getData('drag_type');

        if (id === newParentId) return;
        pushHistory();

        if (type === 'board') {
            setBoards(prev => prev.map(b => b.id.toString() === id ? { ...b, parentId: newParentId } : b));
        } else if (type === 'group') {
            setGroups(prev => ({ ...prev, [id]: { ...prev[id], parentId: newParentId } }));
        }
    },

    // ─── Drop to floor: set the board so its bottom face sits at Y=0 ─────────
    dropBoardToFloor: () => {
        const { selectedItemIds, boards, pushHistory, setBoards } = get();
        const selectedBoard = selectedItemIds.length === 1 && boards.find(b => b.id.toString() === selectedItemIds[0]);
        if (!selectedBoard) return;
        pushHistory();

        // Bottom of board = position.y - size.y/2. We want bottom at Y=0.
        const newY = selectedBoard.size[1] / 2;

        setBoards(boards.map(b => {
            if (selectedItemIds.includes(b.id.toString())) {
                return { ...b, position: [b.position[0], newY, b.position[2]] };
            }
            return b;
        }));
    },

    dropGroupToFloor: () => {
        const { selectedItemIds, groups, pushHistory, boards, setBoards } = get();
        const selectedGroup = selectedItemIds.length === 1 && Object.keys(groups).find(k => k === selectedItemIds[0]);
        if (!selectedGroup) return;
        pushHistory();

        // Find the lowest Y extent of all child boards
        const childBoards = collectChildBoards(selectedGroup, boards, groups);
        if (childBoards.length === 0) return;

        let lowestY = Infinity;
        childBoards.forEach(b => {
            const bottomY = b.position[1] - b.size[1] / 2;
            if (bottomY < lowestY) lowestY = bottomY;
        });

        if (lowestY === Infinity) return;
        // Shift all child boards so the lowest is sitting on Y=0
        const delta = -lowestY;

        const childIds = new Set(childBoards.map(b => b.id.toString()));
        setBoards(boards.map(b => {
            if (childIds.has(b.id.toString())) {
                return { ...b, position: [b.position[0], b.position[1] + delta, b.position[2]] };
            }
            return b;
        }));
    },

    manualAddBoard: () => {
        const { selectedItemIds, boards, groups, setNewBoardDialog } = get();
        const selectedBoard = selectedItemIds.length === 1 && boards.find(b => b.id.toString() === selectedItemIds[0]);
        const selectedGroup = selectedItemIds.length === 1 && Object.keys(groups).find(k => k === selectedItemIds[0]);

        const targetParent = selectedGroup || (selectedBoard ? selectedBoard.parentId : 'Workspace');
        setNewBoardDialog({
            name: 'New Component',
            parentId: targetParent,
            sizeX: 12,
            sizeY: 0.75,
            sizeZ: 12,
            position: [0, 0.375, 0]
        });
    },

    handleAssemblyDelete: () => {
        const { setConfirmDialog, selectedItemIds, groups, pushHistory, boards, setGroups, setBoards, setSelectedItemIds } = get();
        const selectedGroup = selectedItemIds.length === 1 && Object.keys(groups).find(k => k === selectedItemIds[0]);
        const groupToDelete = selectedGroup;
        setConfirmDialog({
            message: `Are you sure you want to delete assembly "${groupToDelete}"? This will permanently delete ALL nested sub-assemblies and components.`,
            onConfirm: () => {
                pushHistory();
                let allGroupIdsToDel = new Set([groupToDelete]);
                let allBoardIdsToDel = new Set();
                const traverse = (pId) => {
                    Object.keys(groups).forEach(k => { if (groups[k].parentId === pId && !allGroupIdsToDel.has(k)) { allGroupIdsToDel.add(k); traverse(k); } });
                    boards.forEach(bd => { if (bd.parentId === pId) allBoardIdsToDel.add(bd.id); });
                };
                traverse(groupToDelete);

                setGroups(prev => {
                    let nextGroups = { ...prev };
                    allGroupIdsToDel.forEach(id => delete nextGroups[id]);
                    return nextGroups;
                });
                setBoards(prev => prev.filter(bd => !allBoardIdsToDel.has(bd.id)));
                setSelectedItemIds(prev => prev.filter(id => !allBoardIdsToDel.has(parseInt(id)) && !allGroupIdsToDel.has(id)));
                setConfirmDialog(null);
            }
        });
    },

    handleComponentDelete: () => {
        const { setConfirmDialog, selectedItemIds, boards, pushHistory, setBoards, setSelectedItemIds } = get();
        const selectedBoard = selectedItemIds.length === 1 && boards.find(b => b.id.toString() === selectedItemIds[0]);
        const boardToDelete = selectedBoard;
        setConfirmDialog({
            message: `Are you sure you want to delete component "${boardToDelete.name}"? This action will permanently remove it from the project.`,
            onConfirm: () => {
                pushHistory();
                setBoards(prev => prev.filter(bd => bd.id !== boardToDelete.id));
                setSelectedItemIds(prev => prev.filter(id => id !== boardToDelete.id.toString()));
                setConfirmDialog(null);
            }
        });
    },

    manualAddAssembly: () => {
        const { pushHistory, selectedItemIds, groups, boards, setGroups, setSelectedItemIds } = get();
        const selectedBoard = selectedItemIds.length === 1 && boards.find(b => b.id.toString() === selectedItemIds[0]);
        const selectedGroup = selectedItemIds.length === 1 && Object.keys(groups).find(k => k === selectedItemIds[0]);

        pushHistory();
        const newId = 'Assembly ' + Math.floor(Math.random() * 1000);
        const targetParent = selectedGroup || (selectedBoard ? selectedBoard.parentId : 'Workspace');
        setGroups(prev => ({
            ...prev,
            [newId]: { parentId: targetParent, isExpanded: true, visible: true }
        }));
        setSelectedItemIds([newId]);
    },

    handleNewBoardConfirm: () => {
        const { pushHistory, newBoardDialog, setBoards, defaultMaterial, setSelectedItemIds, setNewBoardDialog } = get();
        pushHistory();
        const newId = Date.now();

        setBoards(prev => [...prev, {
            id: newId,
            name: newBoardDialog.name || 'New Component',
            parentId: newBoardDialog.parentId,
            size: [newBoardDialog.sizeX, newBoardDialog.sizeY, newBoardDialog.sizeZ],
            position: newBoardDialog.position,
            material: defaultMaterial,
            joint: 'None',
            constraints: []
        }]);
        setSelectedItemIds([newId.toString()]);
        setNewBoardDialog(null);
    },

});
