import { computeWorldAABB, collectChildBoards, calculateGroupAABB } from '../utils/sceneGraph';
import { checkConstraintConflict, propagateMove, solveFlushSnap, faceToAxis } from '../utils/constraintSolver';
import { calculateProceduralBoxWalls } from '../utils/procedural';
import { persistLibrary, setupDiskBackup, importLibraryFromFile } from '../utils/libraryPersistence';

export const createActions = (set, get) => ({

    // ─── Assembly Library Actions ────────────────────────────────────────────

    /**
     * Save the currently selected group (and its entire sub-tree) to the library.
     * Only intra-assembly constraints are kept; cross-assembly ones are dropped.
     *
     * @param {{ name: string, category: string, tags: string[], thumbnail: string, replaceId?: string }} meta
     *   replaceId — if set, overwrites that existing entry in-place instead of adding a new one.
     */
    saveAssemblyToLibrary: async ({ name, category, tags, thumbnail, replaceId }) => {
        const { selectedItemIds, groups, boards, constraints, assemblyLibrary, libraryDiskHandle, setAssemblyLibrary, showToast } = get();

        // Require exactly one group selected
        const selectedGroupId = selectedItemIds.length === 1 && Object.keys(groups).find(k => k === selectedItemIds[0]);
        if (!selectedGroupId) { showToast('Select a single assembly (group) to save.'); return; }

        // ── Collect the full sub-tree of groups ───────────────────────────────
        const collectGroupSubTree = (rootId) => {
            const result = {};
            const traverse = (id) => {
                result[id] = { ...groups[id] };
                Object.keys(groups).filter(k => groups[k].parentId === id).forEach(traverse);
            };
            traverse(rootId);
            return result;
        };

        const snapshotGroups = collectGroupSubTree(selectedGroupId);
        const groupIdsInAssembly = new Set(Object.keys(snapshotGroups));

        // ── Collect all descendant boards ─────────────────────────────────────
        const snapshotBoards = boards.filter(b => {
            let pid = b.parentId;
            while (pid) {
                if (groupIdsInAssembly.has(pid)) return true;
                const pg = groups[pid];
                pid = pg ? pg.parentId : null;
            }
            return false;
        }).map(b => ({ ...b }));

        const boardIdsInAssembly = new Set(snapshotBoards.map(b => b.id.toString()));

        // ── Filter constraints: keep only intra-assembly ones ─────────────────
        const snapshotConstraints = {};
        Object.entries(constraints).forEach(([cId, c]) => {
            if (boardIdsInAssembly.has(c.boardAId) && boardIdsInAssembly.has(c.boardBId)) {
                snapshotConstraints[cId] = { ...c };
            }
        });

        // ── Normalise: re-root the top-level group to parentId: null ──────────
        snapshotGroups[selectedGroupId] = { ...snapshotGroups[selectedGroupId], parentId: null };

        // ── Build the updated entry ───────────────────────────────────────────
        // When replacing, keep the original id so it stays in the same position
        // in the list and all references remain valid.
        const entryId = replaceId ?? crypto.randomUUID();

        const entry = {
            id: entryId,
            name,
            category: category || 'Uncategorized',
            tags: tags || [],
            thumbnail,
            groups: snapshotGroups,
            boards: snapshotBoards,
            constraints: snapshotConstraints,
            savedAt: Date.now(),
        };

        let next;
        if (replaceId) {
            // Swap out the existing entry in-place (preserves list order)
            next = assemblyLibrary.map(e => e.id === replaceId ? entry : e);
        } else {
            next = [...assemblyLibrary, entry];
        }

        setAssemblyLibrary(next);
        await persistLibrary(next, libraryDiskHandle);
        showToast(replaceId ? `"${name}" updated in library ✓` : `"${name}" saved to library ✓`);
    },

    /**
     * Stamp a library entry back into the viewport.
     * Generates fresh UUIDs for all groups + boards; remaps all cross-references.
     * The top-level group is auto-selected.
     */
    placeAssemblyFromLibrary: (assemblyId) => {
        const { assemblyLibrary, boards, groups, constraints, setBoards, setGroups, setConstraints, setSelectedItemIds, pushHistory, showToast } = get();

        const entry = assemblyLibrary.find(e => e.id === assemblyId);
        if (!entry) return;
        pushHistory();

        const existingGroupNames = new Set(Object.keys(groups));

        // Helper: find a unique group name by appending -2, -3, …
        const uniqueGroupName = (base) => {
            if (!existingGroupNames.has(base)) { existingGroupNames.add(base); return base; }
            let n = 2;
            while (existingGroupNames.has(`${base}-${n}`)) n++;
            const name = `${base}-${n}`;
            existingGroupNames.add(name);
            return name;
        };

        // ── Find root group (parentId === null in snapshot) ───────────────────
        const oldRootId = Object.keys(entry.groups).find(id => entry.groups[id].parentId === null);

        // ── Build group ID map: old key → new readable key ────────────────────
        const groupIdMap = {};
        // Root group gets the entry.name with suffix
        groupIdMap[oldRootId] = uniqueGroupName(entry.name);
        // Sub-groups keep their original key name, suffixed if needed
        Object.keys(entry.groups).forEach(oldId => {
            if (oldId !== oldRootId) {
                groupIdMap[oldId] = uniqueGroupName(oldId);
            }
        });

        const newRootId = groupIdMap[oldRootId];

        // ── Board IDs: continue from scene max ────────────────────────────────
        let nextBoardId = Math.max(0, ...boards.map(b => parseInt(b.id) || 0)) + 1;
        const boardIdMap = {};
        entry.boards.forEach(b => {
            boardIdMap[b.id.toString()] = nextBoardId++;
        });

        // ── Remap groups ──────────────────────────────────────────────────────
        const newGroups = {};
        Object.entries(entry.groups).forEach(([oldId, g]) => {
            const newId = groupIdMap[oldId];
            const newParentId = g.parentId === null
                ? 'Workspace'
                : (groupIdMap[g.parentId] ?? g.parentId);
            newGroups[newId] = { ...g, parentId: newParentId };
        });

        // ── Remap boards ──────────────────────────────────────────────────────
        const newBoards = entry.boards.map(b => ({
            ...b,
            id: boardIdMap[b.id.toString()],
            parentId: groupIdMap[b.parentId] ?? b.parentId,
        }));

        // ── Remap constraints (keys stay as timestamps — invisible to user) ───
        const newConstraints = {};
        Object.entries(entry.constraints || {}).forEach(([, c]) => {
            const newCId = Date.now().toString() + Math.random();
            newConstraints[newCId] = {
                ...c,
                boardAId: boardIdMap[c.boardAId]?.toString() ?? c.boardAId,
                boardBId: boardIdMap[c.boardBId]?.toString() ?? c.boardBId,
            };
        });

        // ── Commit ────────────────────────────────────────────────────────────
        setGroups(prev => ({ ...prev, ...newGroups }));
        setBoards(prev => [...prev, ...newBoards]);
        setConstraints(prev => ({ ...prev, ...newConstraints }));
        setSelectedItemIds([newRootId]);
        showToast(`Placed "${newRootId}" ✓ — move it using the Inspector or AI chat.`);
    },

    /**
     * Remove a library entry and persist the updated list.
     */
    deleteAssemblyFromLibrary: async (assemblyId) => {
        const { assemblyLibrary, libraryDiskHandle, setAssemblyLibrary, showToast } = get();
        const entry = assemblyLibrary.find(e => e.id === assemblyId);
        const next = assemblyLibrary.filter(e => e.id !== assemblyId);
        setAssemblyLibrary(next);
        await persistLibrary(next, libraryDiskHandle);
        if (entry) showToast(`"${entry.name}" removed from library.`);
    },

    /**
     * Update editable metadata on an existing library entry (name, category, tags).
     * @param {string} assemblyId
     * @param {{ name?: string, category?: string, tags?: string[] }} patch
     */
    updateAssemblyInLibrary: async (assemblyId, patch) => {
        const { assemblyLibrary, libraryDiskHandle, setAssemblyLibrary, showToast } = get();
        const next = assemblyLibrary.map(e =>
            e.id === assemblyId ? { ...e, ...patch } : e
        );
        setAssemblyLibrary(next);
        await persistLibrary(next, libraryDiskHandle);
        showToast('Library entry updated ✓');
    },

    /**
     * Opens a save-file picker to choose (or re-choose) the disk backup location.
     */
    setupLibraryDiskBackup: async () => {
        const { assemblyLibrary, setLibraryDiskHandle, showToast } = get();
        const handle = await setupDiskBackup(assemblyLibrary);
        if (handle) {
            setLibraryDiskHandle(handle);
            showToast('Library backup file set ✓ — auto-saving on every change.');
        }
    },

    /**
     * Opens an open-file picker to import (merge) a library JSON file.
     */
    importLibraryFromFile: async () => {
        const { assemblyLibrary, libraryDiskHandle, setAssemblyLibrary, showToast } = get();
        const { merged, count } = await importLibraryFromFile(assemblyLibrary);
        if (count > 0) {
            setAssemblyLibrary(merged);
            await persistLibrary(merged, libraryDiskHandle);
            showToast(`Imported ${count} new assembly${count !== 1 ? 's' : ''} ✓`);
        } else {
            showToast('No new assemblies found in file.');
        }
    },

    // ── end library actions ──────────────────────────────────────────────────

    /**
     * Apply a material descriptor to all selected boards (or set defaultMaterial
     * if nothing is selected). Tracks recent custom paint colours.
     *
     * @param {{ type: 'wood'|'color', id?: string, hex?: string }} matDesc
     */
    applyMaterial: (matDesc) => {
        const { selectedItemIds, boards, groups, setBoards, setDefaultMaterial, setRecentColors, recentColors, pushHistory, showToast } = get();

        if (selectedItemIds.length === 0) {
            // No selection — update the global default for future new boards
            setDefaultMaterial(matDesc);
            const label = matDesc.type === 'color' ? matDesc.hex : matDesc.id;
            showToast(`Default material → ${label}`);
        } else {
            pushHistory();

            // Collect all board IDs to update (direct + inside selected groups)
            const boardIds = new Set();
            const collectBoards = (gid) => {
                boards.filter(b => b.parentId === gid).forEach(b => boardIds.add(b.id.toString()));
                Object.keys(groups).filter(k => groups[k].parentId === gid).forEach(collectBoards);
            };
            selectedItemIds.forEach(id => {
                if (groups[id]) collectBoards(id);
                else boardIds.add(id);
            });

            setBoards(prev => prev.map(b =>
                boardIds.has(b.id.toString()) ? { ...b, material: matDesc } : b
            ));

            const label = matDesc.type === 'color' ? matDesc.hex : matDesc.id;
            showToast(`Material → ${label} ✓`);
        }

        // Track recent custom colours (max 8, newest first)
        if (matDesc.type === 'color') {
            const updated = [matDesc.hex, ...recentColors.filter(c => c !== matDesc.hex)].slice(0, 8);
            setRecentColors(updated);
        }
    },


    saveWorkspace: (isNamedSave = false) => {
        const { boards, groups, constraints, theme, units, gridSnap, defaultMaterial, showEdges, showDimensions, showBoundingBox, globalBounds, lighting, recentColors, recentFiles, setRecentFiles, showToast } = get();
        let name = "My Design";
        if (recentFiles.length > 0) name = recentFiles[0].name;

        if (isNamedSave) {
            let pName = prompt("Save Project As:", name);
            if (!pName) return;
            name = pName;
        }

        const payload = { boards, groups, constraints, theme, units, gridSnap, defaultMaterial, showEdges, showDimensions, showBoundingBox, globalBounds, lighting, recentColors };
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
        const { setBoards, setGroups, setConstraints, setTheme, setUnits, setGridSnap, setDefaultMaterial, setShowEdges, setShowDimensions, setLighting, setRecentColors } = get();
        const key = name ? 'lucey_save_' + name : 'lucey_save';
        const s = localStorage.getItem(key);
        if (s) {
            try {
                const p = JSON.parse(s);
                if (p.boards && p.groups) {
                    // Migrate old boards that have constraints[] — strip them off
                    setBoards(p.boards.map(b => { const { constraints: _, ...rest } = b; return rest; }));
                    setGroups(p.groups);
                    setConstraints(p.constraints || {});
                    if (p.theme) setTheme(p.theme);
                    if (p.units) setUnits(p.units);
                    if (p.gridSnap) setGridSnap(p.gridSnap);
                    if (p.defaultMaterial) setDefaultMaterial(p.defaultMaterial);
                    if (p.showEdges !== undefined) setShowEdges(p.showEdges);
                    if (p.showDimensions !== undefined) setShowDimensions(p.showDimensions);
                    if (p.lighting) setLighting(p.lighting);
                    if (p.recentColors) setRecentColors(p.recentColors);
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
        const { constraintTargetMode, setConstraintTargetMode, pushHistory, boards, groups, constraints, setConstraints, setBoards, selectedItemIds, setSelectedItemIds, showToast } = get();
        const strId = id.toString();

        if (constraintTargetMode && constraintTargetMode.active) {

            // ── Glue: step 1 only — just pick the target board (no face needed) ─
            if (constraintTargetMode.type === 'Glue') {
                if (strId === constraintTargetMode.sourceId) return; // can't glue to self
                const boardA = boards.find(b => b.id.toString() === constraintTargetMode.sourceId);
                const boardB = boards.find(b => b.id.toString() === strId);
                if (!boardA || !boardB) return;

                const proposed = { type: 'Glue', boardAId: constraintTargetMode.sourceId, boardBId: strId };
                const conflict = checkConstraintConflict(proposed, constraints, boards);
                if (conflict) {
                    showToast('⚠️ ' + conflict);
                    setConstraintTargetMode(null);
                    return;
                }

                pushHistory();
                const offset = [
                    boardB.position[0] - boardA.position[0],
                    boardB.position[1] - boardA.position[1],
                    boardB.position[2] - boardA.position[2],
                ];
                const id = Date.now().toString();
                setConstraints(prev => ({ ...prev, [id]: { type: 'Glue', boardAId: boardA.id.toString(), boardBId: boardB.id.toString(), offset, enabled: true } }));
                setConstraintTargetMode(null);
                showToast(`Glued "${boardA.name}" to "${boardB.name}"`);
                return;
            }

            // ── Flush: 2-step face picker ─────────────────────────────────────
            if (!faceStr) return;

            if (constraintTargetMode.step === 1) {
                if (strId !== constraintTargetMode.sourceId) return;
                setConstraintTargetMode({ ...constraintTargetMode, step: 2, sourceFace: faceStr });
            } else if (constraintTargetMode.step === 2) {
                if (strId === constraintTargetMode.sourceId) return;

                const boardA = boards.find(b => b.id.toString() === constraintTargetMode.sourceId);
                const boardB = boards.find(b => b.id.toString() === strId);
                if (!boardA || !boardB) return;

                const axis = faceToAxis(constraintTargetMode.sourceFace);
                const proposed = { type: 'Flush', boardAId: boardA.id.toString(), boardBId: strId, faceA: constraintTargetMode.sourceFace, faceB: faceStr };
                const conflict = checkConstraintConflict(proposed, constraints, boards);
                if (conflict) {
                    showToast('⚠️ ' + conflict);
                    setConstraintTargetMode(null);
                    return;
                }

                pushHistory();
                // Snap boardA to satisfy the constraint immediately
                const snappedPos = solveFlushSnap(boardA, constraintTargetMode.sourceFace, boardB, faceStr);
                if (snappedPos) {
                    setBoards(prev => prev.map(b => b.id.toString() === boardA.id.toString() ? { ...b, position: snappedPos } : b));
                }

                const cId = Date.now().toString();
                setConstraints(prev => ({ ...prev, [cId]: { type: 'Flush', boardAId: boardA.id.toString(), boardBId: strId, faceA: constraintTargetMode.sourceFace, faceB: faceStr, axis, enabled: true } }));
                setConstraintTargetMode(null);
                showToast(`Flush constraint added on ${['X','Y','Z'][axis]} axis.`);
            }
            return;
        }

        if (isMulti) {
            setSelectedItemIds(prev => prev.includes(strId) ? prev.filter(x => x !== strId) : [...prev, strId]);
        } else {
            setSelectedItemIds([strId]);
        }
    },

    // ─── Add / remove / toggle constraints ──────────────────────────────────
    removeConstraint: (constraintId) => {
        const { pushHistory, setConstraints } = get();
        pushHistory();
        setConstraints(prev => { const next = { ...prev }; delete next[constraintId]; return next; });
    },

    toggleConstraint: (constraintId) => {
        const { setConstraints } = get();
        setConstraints(prev => ({ ...prev, [constraintId]: { ...prev[constraintId], enabled: prev[constraintId].enabled === false ? true : false } }));
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
        const { selectedItemIds, pushHistory, boards, constraints, setBoards } = get();
        if (selectedItemIds.length === 0) return;
        pushHistory();

        const floatVal = parseFloat(value) || 0;

        if (key === 'position') {
            // Find the primary board to compute delta
            const primaryBoard = boards.find(bd => selectedItemIds.includes(bd.id.toString()));
            if (!primaryBoard) return;
            const delta = floatVal - primaryBoard.position[index];
            if (delta === 0) return;

            const deltaVec = [0, 0, 0];
            deltaVec[index] = delta;

            // Propagate through constraints
            const moveMap = propagateMove(selectedItemIds, deltaVec, constraints);

            setBoards(boards.map(b => {
                const d = moveMap.get(b.id.toString());
                if (d) {
                    return { ...b, position: [b.position[0] + d[0], b.position[1] + d[1], b.position[2] + d[2]] };
                }
                return b;
            }));
        } else {
            // Size / other scalar field — only apply to directly selected boards
            setBoards(boards.map(b => {
                if (selectedItemIds.includes(b.id.toString())) {
                    let newVec = [...b[key]];
                    newVec[index] = floatVal;
                    return { ...b, [key]: newVec };
                }
                return b;
            }));
        }
    },

    // ─── Move all boards in a group by a delta ───────────────────────────────
    moveGroup: (groupId, axis, delta) => {
        const { pushHistory, boards, groups, constraints, setBoards } = get();
        if (delta === 0) return;
        pushHistory();

        const childBoards = collectChildBoards(groupId, boards, groups);
        const childIds = childBoards.map(b => b.id.toString());

        const deltaVec = [0, 0, 0];
        deltaVec[axis] = delta;

        const moveMap = propagateMove(childIds, deltaVec, constraints);

        setBoards(boards.map(b => {
            const d = moveMap.get(b.id.toString());
            if (d) {
                return { ...b, position: [b.position[0] + d[0], b.position[1] + d[1], b.position[2] + d[2]] };
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
        const { pushHistory, selectedItemIds, setBoards, setGroups, setSelectedItemIds, boards, groups, constraints, defaultMaterial, globalBounds, setChatMessages } = get();
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

            const deltaVec = [0, 0, 0];
            deltaVec[axis] = val;
            const moveMap = propagateMove(selectedItemIds, deltaVec, constraints);

            setBoards(prev => prev.map(b => {
                const d = moveMap.get(b.id.toString());
                if (d) {
                    return { ...b, position: [b.position[0] + d[0], b.position[1] + d[1], b.position[2] + d[2]] };
                }
                return b;
            }));

            const axisName = ['red (X)', 'green (Y)', 'blue (Z)'][axis];
            reply = `Moved ${moveMap.size} component(s) by ${val}" along ${axisName}.`;
            updated = true;

        // ── Add leg ──────────────────────────────────────────────────────────
        } else if (lower.includes('add') && lower.includes('leg')) {
            const newId = Date.now();
            setBoards(prev => [...prev, { id: newId, name: 'New Leg', parentId: 'Workspace', size: [1.5, 12, 1.5], position: [0, 6, 0], material: defaultMaterial, joint: 'Butt 1' }]);
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
                    joint: 'None'
                }]);
                setSelectedItemIds([newId.toString()]);
                reply = `Generated top at Y=${newY.toFixed(2)}".`;
                updated = true;
            }

        // ── Build cube ───────────────────────────────────────────────────────
        // All 6 panels are identical 12×12×0.75".
        // Outer extent is 12" in every axis; 3 panels overlap at every corner.
        } else if (/(build|create|make).+cube/i.test(lower)) {
            const side = 12, t = 0.75;
            const half = side / 2;

            const newGroupId = 'Cube ' + Math.floor(Math.random() * 1000);
            setGroups(prev => ({
                ...prev,
                [newGroupId]: { parentId: 'Workspace', isExpanded: true, visible: true }
            }));

            // Panel positions so outer extents are 0→12 in Y, -6→+6 in X and Z
            const panelDefs = [
                { name: 'Bottom', size: [side, t,    side], position: [0,         t / 2,        0]          },
                { name: 'Top',    size: [side, t,    side], position: [0,         side - t / 2, 0]          },
                { name: 'Front',  size: [side, side, t],    position: [0,         half,         half - t / 2]  },
                { name: 'Back',   size: [side, side, t],    position: [0,         half,        -(half - t / 2)] },
                { name: 'Left',   size: [t,    side, side], position: [-(half - t / 2), half,  0]          },
                { name: 'Right',  size: [t,    side, side], position: [ half - t / 2,  half,  0]          },
            ];

            const cubeBoards = panelDefs.map((bd, i) => ({
                id: Date.now() + i,
                name: bd.name,
                size: bd.size,
                position: bd.position,
                parentId: newGroupId,
                material: defaultMaterial,
                joint: 'None',
            }));

            setBoards(prev => [...prev, ...cubeBoards]);
            setSelectedItemIds([newGroupId]);
            reply = `Built a 12" cube — 6 panels, each 12×12×0.75", overlapping at every corner.`;
            updated = true;

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
                joint: 'None'
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
        const { selectedItemIds } = get();
        // If the dragged item is part of the current selection, move all selected items.
        // Otherwise, just move the single dragged item.
        const idsToMove = selectedItemIds.includes(id.toString())
            ? selectedItemIds
            : [id.toString()];
        e.dataTransfer.setData('drag_ids', JSON.stringify(idsToMove));
        e.dataTransfer.setData('drag_id', id); // keep for backwards compat
        e.dataTransfer.setData('drag_type', type);
        e.stopPropagation();
    },

    handleDrop: (e, newParentId) => {
        const { pushHistory, setBoards, setGroups, groups, boards } = get();
        e.preventDefault();
        e.stopPropagation();

        // Try multi-select payload first, fall back to single
        let ids;
        try {
            ids = JSON.parse(e.dataTransfer.getData('drag_ids') || '[]');
        } catch { ids = []; }
        if (!ids.length) ids = [e.dataTransfer.getData('drag_id')].filter(Boolean);

        // Remove the target itself to prevent circular reparenting
        ids = ids.filter(id => id !== newParentId);
        if (!ids.length) return;

        pushHistory();

        const boardIds = new Set(ids.filter(id => boards.some(b => b.id.toString() === id)));
        const groupIds = ids.filter(id => groups[id] !== undefined);

        setBoards(prev => prev.map(b =>
            boardIds.has(b.id.toString()) ? { ...b, parentId: newParentId } : b
        ));
        setGroups(prev => {
            let next = { ...prev };
            groupIds.forEach(id => {
                if (next[id]) next[id] = { ...next[id], parentId: newParentId };
            });
            return next;
        });
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

    handleMultiDelete: () => {
        const { setConfirmDialog, selectedItemIds, groups, boards, constraints, pushHistory, setBoards, setGroups, setSelectedItemIds, setConstraints } = get();
        const count = selectedItemIds.length;
        setConfirmDialog({
            message: `Delete ${count} selected item${count !== 1 ? 's' : ''}? This will remove all selected boards and assemblies (including their children) permanently.`,
            onConfirm: () => {
                pushHistory();

                const allGroupIdsToDel = new Set();
                const allBoardIdsToDel = new Set();

                const traverseGroup = (gId) => {
                    allGroupIdsToDel.add(gId);
                    Object.keys(groups).forEach(k => {
                        if (groups[k].parentId === gId) traverseGroup(k);
                    });
                    boards.forEach(bd => {
                        if (bd.parentId === gId) allBoardIdsToDel.add(bd.id.toString());
                    });
                };

                selectedItemIds.forEach(id => {
                    if (groups[id]) {
                        traverseGroup(id);
                    } else {
                        allBoardIdsToDel.add(id);
                    }
                });

                setBoards(prev => prev.filter(bd => !allBoardIdsToDel.has(bd.id.toString())));
                setGroups(prev => {
                    const next = { ...prev };
                    allGroupIdsToDel.forEach(id => delete next[id]);
                    return next;
                });
                // Remove constraints that reference any deleted board
                setConstraints(prev => {
                    const next = {};
                    Object.entries(prev).forEach(([cId, c]) => {
                        if (!allBoardIdsToDel.has(c.boardAId) && !allBoardIdsToDel.has(c.boardBId)) {
                            next[cId] = c;
                        }
                    });
                    return next;
                });
                setSelectedItemIds([]);
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
