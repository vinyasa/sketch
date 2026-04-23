import * as THREE from 'three';
import { computeWorldAABB, collectChildBoards, calculateGroupAABB } from '../utils/sceneGraph';
import { checkConstraintConflict, propagateMove, solveFlushSnap, faceToAxis } from '../utils/constraintSolver';
import { calculateProceduralBoxWalls } from '../utils/procedural';
import { persistLibrary, setupDiskBackup, importLibraryFromFile } from '../utils/libraryPersistence';
import { WOOD_CATALOGUE, PAINT_PALETTE } from '../utils/materialCatalogue';
// normalizeTaper import removed — no longer needed after applyRotation deletion
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
        const { boards, groups, constraints, theme, units, gridSnap, defaultMaterial, showEdges, showDimensions, showBoundingBox, globalBounds, lighting, recentColors, autosaveInterval, cameraState, recentFiles, setRecentFiles, setCurrentFileName, showToast } = get();
        let name = "My Design";
        if (recentFiles.length > 0) name = recentFiles[0].name;

        if (isNamedSave) {
            let pName = prompt("Save Project As:", name);
            if (!pName) return;
            name = pName;
        }

        const payload = { boards, groups, constraints, theme, units, gridSnap, defaultMaterial, showEdges, showDimensions, showBoundingBox, globalBounds, lighting, recentColors, autosaveInterval, cameraState };
        localStorage.setItem('lucey_save_' + name, JSON.stringify(payload));

        let newRecents = recentFiles.filter(r => r.name !== name);
        newRecents.unshift({ name, timestamp: Date.now() });
        if (newRecents.length > 5) newRecents = newRecents.slice(0, 5);
        setRecentFiles(newRecents);
        localStorage.setItem('lucey_recent_files', JSON.stringify(newRecents));

        localStorage.setItem('lucey_save', JSON.stringify(payload));
        setCurrentFileName(name);
        showToast(`Saved layout to local storage`);
    },

    loadWorkspace: (name) => {
        const { setBoards, setGroups, setConstraints, setTheme, setUnits, setGridSnap, setDefaultMaterial, setShowEdges, setShowDimensions, setLighting, setRecentColors, setAutosaveInterval, setCurrentFileName } = get();
        const key = name ? 'lucey_save_' + name : 'lucey_save';
        const s = localStorage.getItem(key);
        if (s) {
            try {
                const p = JSON.parse(s);
                if (p.boards && p.groups) {
                    // Migrate old boards: strip legacy constraints[], rename rotation → orientation
                    setBoards(p.boards.map(b => {
                        const { constraints: _, rotation, ...rest } = b;
                        return {
                            ...rest,
                            ...(rotation && !b.orientation ? { orientation: rotation } : {}),
                        };
                    }));
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
                    if (p.autosaveInterval) setAutosaveInterval(p.autosaveInterval);
                    if (p.cameraState) get().setCameraState(p.cameraState);
                    if (name) setCurrentFileName(name);
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
                set({ currentFileName: handle.name.replace(/\.json$/i, '') });
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
        const { setBoards, setGroups, setConstraints, resetHistory, setCurrentFileName } = get();
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const p = JSON.parse(event.target.result);
                if (p.boards && p.groups) {
                    // Sanitize boards: ensure required fields exist and strip legacy constraints
                    const sanitized = p.boards.map(b => {
                        const { constraints: _, rotation, ...rest } = b;
                        return {
                            ...rest,
                            size: Array.isArray(b.size) && b.size.length === 3 ? b.size : [1, 1, 1],
                            position: Array.isArray(b.position) && b.position.length === 3 ? b.position : [0, 0.5, 0],
                            operations: Array.isArray(b.operations) ? b.operations : [],
                            shape: b.shape || 'box',
                            // Migrate legacy rotation → orientation
                            ...(rotation && !b.orientation ? { orientation: rotation } : {}),
                        };
                    });
                    setBoards(sanitized);
                    setGroups(p.groups);
                    if (p.constraints) setConstraints(p.constraints);
                    setCurrentFileName(file.name.replace(/\.json$/i, ''));
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

    // ─── CSG Operation CRUD ──────────────────────────────────────────────────
    addOperation: (boardId, opType) => {
        const { pushHistory, setBoards } = get();
        pushHistory();
        const defaults = {
            hole:  { type: 'hole',  radius: 1,   offsetX: 0, offsetY: 0, axis: 'y' },
            cove:  { type: 'cove',  edge: 'top', depth: 1,   axis: 'y' },
            arc:   { type: 'arc',   startAngle: 0, endAngle: 90, innerRadius: 0, axis: 'y' },
        };
        const op = { id: Date.now(), ...(defaults[opType] ?? { type: opType }) };
        setBoards(prev => prev.map(b =>
            b.id.toString() === boardId.toString()
                ? { ...b, operations: [...(b.operations || []), op] }
                : b
        ));
    },

    updateOperation: (boardId, opId, patch) => {
        const { pushHistory, setBoards } = get();
        pushHistory();
        setBoards(prev => prev.map(b =>
            b.id.toString() === boardId.toString()
                ? { ...b, operations: (b.operations || []).map(o => o.id === opId ? { ...o, ...patch } : o) }
                : b
        ));
    },

    removeOperation: (boardId, opId) => {
        const { pushHistory, setBoards } = get();
        pushHistory();
        setBoards(prev => prev.map(b =>
            b.id.toString() === boardId.toString()
                ? { ...b, operations: (b.operations || []).filter(o => o.id !== opId) }
                : b
        ));
    },

    // ─── Hardware Attachment CRUD ────────────────────────────────────────────
    addHardware: (boardId, catalogueItem, face) => {
        const { pushHistory, setBoards } = get();
        pushHistory();
        const hw = {
            id: 'hw_' + Date.now(),
            name: catalogueItem.label,
            modelUrl: catalogueItem.modelUrl,
            catalogueId: catalogueItem.id,
            face: face || catalogueItem.defaultFace || 'front',
            offset: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: 1,
        };
        setBoards(prev => prev.map(b =>
            b.id.toString() === boardId.toString()
                ? { ...b, hardware: [...(b.hardware || []), hw] }
                : b
        ));
    },

    updateHardware: (boardId, hwId, patch) => {
        const { pushHistory, setBoards } = get();
        pushHistory();
        setBoards(prev => prev.map(b =>
            b.id.toString() === boardId.toString()
                ? { ...b, hardware: (b.hardware || []).map(h => h.id === hwId ? { ...h, ...patch } : h) }
                : b
        ));
    },

    removeHardware: (boardId, hwId) => {
        const { pushHistory, setBoards } = get();
        pushHistory();
        setBoards(prev => prev.map(b =>
            b.id.toString() === boardId.toString()
                ? { ...b, hardware: (b.hardware || []).filter(h => h.id !== hwId) }
                : b
        ));
    },

    // ─── Boolean Subtraction ─────────────────────────────────────────────────

    /**
     * Subtract one board's shape from another (snapshot approach).
     * The cutter's geometry (size, shape) and the relative transform between
     * target and cutter are frozen at apply-time so the operation is self-contained.
     *
     * @param {string|number} targetBoardId — board that receives the cut
     * @param {string|number} cutterBoardId — board whose shape is carved out
     */
    applySubtraction: (targetBoardId, cutterBoardId) => {
        const { boards, pushHistory, setBoards, showToast } = get();
        const targetBoard = boards.find(b => b.id.toString() === targetBoardId.toString());
        const cutterBoard = boards.find(b => b.id.toString() === cutterBoardId.toString());
        if (!targetBoard || !cutterBoard) return;

        // ── Validate overlap ──────────────────────────────────────────────
        const bbOf = (b) => [0, 1, 2].map(i => ({
            min: b.position[i] - b.size[i] / 2,
            max: b.position[i] + b.size[i] / 2,
        }));
        const ba = bbOf(targetBoard), bb = bbOf(cutterBoard);
        const overlapping = [0, 1, 2].every(i =>
            Math.min(ba[i].max, bb[i].max) - Math.max(ba[i].min, bb[i].min) > 0.01
        );
        if (!overlapping) {
            showToast('⚠ Boards must overlap to apply a boolean subtraction');
            return;
        }

        // ── Compute relative transform (cutter in target's local space) ───
        const targetEuler = new THREE.Euler(...(targetBoard.orientation || [0, 0, 0]), 'YXZ');
        const targetMatrix = new THREE.Matrix4().compose(
            new THREE.Vector3(...targetBoard.position),
            new THREE.Quaternion().setFromEuler(targetEuler),
            new THREE.Vector3(1, 1, 1)
        );

        const cutterEuler = new THREE.Euler(...(cutterBoard.orientation || [0, 0, 0]), 'YXZ');
        const cutterMatrix = new THREE.Matrix4().compose(
            new THREE.Vector3(...cutterBoard.position),
            new THREE.Quaternion().setFromEuler(cutterEuler),
            new THREE.Vector3(1, 1, 1)
        );

        const relativeMatrix = targetMatrix.clone().invert().multiply(cutterMatrix);

        // ── Build the operation (frozen snapshot) ─────────────────────────
        const op = {
            id: Date.now(),
            type: 'subtract',
            cutterName: cutterBoard.name,
            cutterId: cutterBoard.id.toString(),
            cutterSize: [...cutterBoard.size],
            cutterShape: cutterBoard.shape || 'box',
            cutterTaper: cutterBoard.taper || null,
            cutterCylinder: cutterBoard.cylinder || null,
            relativeMatrix: relativeMatrix.elements.slice(),   // 16-element Float64 array
        };

        pushHistory();
        setBoards(prev => prev.map(b => {
            if (b.id.toString() === targetBoard.id.toString()) {
                return { ...b, operations: [...(b.operations || []), op] };
            }
            // Auto-hide the cutter board
            if (b.id.toString() === cutterBoard.id.toString()) {
                return { ...b, visible: false };
            }
            return b;
        }));
        showToast(`🔪 Subtracted "${cutterBoard.name}" from "${targetBoard.name}"`);
    },

    // ─── Automated Rabbet Joint ──────────────────────────────────────────────

    /**
     * Apply a rabbet joint between two overlapping perpendicular boards.
     * Config "A-over-B": boardA stays full size, boardB shrinks.
     *
     * Geometry rules (derived for any orientation):
     *   thinA = A's thickness axis,  thicknessA = A.size[thinA]
     *   thinB = B's thickness axis,  thicknessB = B.size[thinB]
     *   sharedAxis = the remaining axis (neither thinA nor thinB)
     *
     *   A (over) gets a dado on the face of its thin axis that faces toward B:
     *     width  = thicknessB / 2      (half of B's thickness)
     *     depth  = thicknessA / 2      (half of A's own thickness)
     *     offset = -[ A.size[thinB]/2 - thicknessB/2 ]
     *
     *   B (under) shrinks by thicknessA/2 along thinA, shifts toward A by thicknessA/4.
     *   B gets a dado on the face of its thin axis that faces toward A:
     *     width  = thicknessA / 2      (half of A's thickness)
     *     depth  = thicknessB / 2      (half of B's own thickness)
     *     offset = -[ B.size[thinA]/2 - thicknessA/2 ]   (using B's NEW shrunken size along thinA)
     */
    applyRabbetJoint: (boardAId, boardBId) => {
        const { boards, pushHistory, setBoards, showToast } = get();
        const boardA = boards.find(b => b.id.toString() === boardAId.toString());
        const boardB = boards.find(b => b.id.toString() === boardBId.toString());
        if (!boardA || !boardB) return;

        // ── Helpers ───────────────────────────────────────────────────────
        const bbOf = (b) => [0, 1, 2].map(i => ({
            min: b.position[i] - b.size[i] / 2,
            max: b.position[i] + b.size[i] / 2,
        }));
        const thinAxisOf = (b) => b.size.indexOf(Math.min(...b.size));
        const FACE_LABELS = {
            'x+': 'right', 'x-': 'left',
            'y+': 'top',   'y-': 'bottom',
            'z+': 'front', 'z-': 'back',
        };
        const AXIS_NAMES = ['x', 'y', 'z'];

        // ── Validate overlap (miter) ──────────────────────────────────────
        const ba = bbOf(boardA), bb = bbOf(boardB);
        const overlapping = [0, 1, 2].every(i =>
            Math.min(ba[i].max, bb[i].max) - Math.max(ba[i].min, bb[i].min) > 0.01
        );
        if (!overlapping) {
            showToast('⚠ Boards must be in miter (overlapping) position first');
            return;
        }

        // ── Validate perpendicular ────────────────────────────────────────
        const thinA = thinAxisOf(boardA);
        const thinB = thinAxisOf(boardB);
        if (thinA === thinB) {
            showToast('⚠ Boards must be perpendicular (different thin axes)');
            return;
        }

        const thicknessA = boardA.size[thinA];
        const thicknessB = boardB.size[thinB];

        // ── Check for existing rabbet between these two boards ────────────
        const hasExisting = (b, pid) =>
            (b.operations || []).some(op => op.source === 'rabbet-joint' && op.partnerId === pid.toString());
        if (hasExisting(boardA, boardB.id) || hasExisting(boardB, boardA.id)) {
            showToast('⚠ A rabbet joint already exists between these boards. Remove it first.');
            return;
        }

        // ── Geometry computation ──────────────────────────────────────────
        const sharedAxis = [0, 1, 2].find(i => i !== thinA && i !== thinB);
        const sharedAxisLabel = AXIS_NAMES[sharedAxis];

        // signA: direction from A toward B along A's thin axis
        const signA = boardB.position[thinA] > boardA.position[thinA] ? 1 : -1;
        // signB: direction from B toward A along B's thin axis
        const signB = boardA.position[thinB] > boardB.position[thinB] ? 1 : -1;

        // A's dado face: on A's thin axis, facing toward B
        const faceA = FACE_LABELS[AXIS_NAMES[thinA] + (signA > 0 ? '+' : '-')];
        // B's dado face: on B's thin axis, facing toward A
        const faceB = FACE_LABELS[AXIS_NAMES[thinB] + (signB > 0 ? '+' : '-')];

        // ── Config "A over B": A keeps full size, B shrinks ───────────────
        // Shrink B along A's thin axis by thicknessA/2
        const shrinkAmount = thicknessA / 2;
        const newBSize = [...boardB.size];
        const newBPos = [...boardB.position];
        newBSize[thinA] -= shrinkAmount;
        // Shift B toward A by thicknessA/4
        newBPos[thinA] = boardB.position[thinA] + signA * (shrinkAmount / 2);

        // ── Correct existing rabbet-joint dados on B ──────────────────────
        // The center shift displaces existing dado offsets whose widthAxis == thinA.
        // Compute widthAxis from a dado's face + direction, then compensate.
        const FACE_INFO = {
            top:    { faceAxes: [0, 2] }, bottom: { faceAxes: [0, 2] },
            front:  { faceAxes: [0, 1] }, back:   { faceAxes: [0, 1] },
            right:  { faceAxes: [1, 2] }, left:   { faceAxes: [1, 2] },
        };
        const AXIS_IDX = { x: 0, y: 1, z: 2 };
        const centerShift = signA * (shrinkAmount / 2);

        const correctedBOps = (boardB.operations || []).map(op => {
            if (op.source !== 'rabbet-joint') return op;
            const fi = FACE_INFO[op.face];
            if (!fi) return op;
            const dirIdx = AXIS_IDX[op.direction];
            const widthAxis = fi.faceAxes[0] === dirIdx ? fi.faceAxes[1] : fi.faceAxes[0];
            if (widthAxis !== thinA) return op;
            return { ...op, offset: op.offset - centerShift };
        });

        // ── A's dado (over board) ─────────────────────────────────────────
        // Face: faceA (on A's thin-axis face toward B)
        // Width:  thicknessB / 2
        // Depth:  thicknessA / 2
        // Offset: -[ A.size[thinB]/2 - thicknessB/4 ]
        const dadoAWidth = thicknessB / 2;
        const dadoADepth = thicknessA / 2;
        const offsetA = -signB * (boardA.size[thinB] / 2 - thicknessB / 4);

        const dadoA = {
            id: Date.now(),
            type: 'dado',
            face: faceA,
            direction: sharedAxisLabel,
            width: dadoAWidth,
            depth: dadoADepth,
            offset: offsetA,
            length: 0,
            lengthOffset: 0,
            source: 'rabbet-joint',
            partnerId: boardB.id.toString(),
        };

        // ── B's dado (under board, after shrink) ──────────────────────────
        // Face: faceB (on B's thin-axis face toward A)
        // Width:  thicknessA / 2
        // Depth:  thicknessB / 2
        // Offset: newBSize[thinA]/2 - thicknessA/4
        const dadoBWidth = thicknessA / 2;
        const dadoBDepth = thicknessB / 2;
        const offsetB = -signA * (newBSize[thinA] / 2 - thicknessA / 4);

        const dadoB = {
            id: Date.now() + 1,
            type: 'dado',
            face: faceB,
            direction: sharedAxisLabel,
            width: dadoBWidth,
            depth: dadoBDepth,
            offset: offsetB,
            length: 0,
            lengthOffset: 0,
            source: 'rabbet-joint',
            partnerId: boardA.id.toString(),
        };

        // Joint metadata stored on both boards for toggle/remove support
        const meta = {
            partnerId: null, // set per-board below
            overBoardId: boardA.id.toString(),
            shrinkAxis: thinA,
            shrinkAmount,
            thicknessA,
            thicknessB,
            signA,
            signB,
        };

        pushHistory();
        setBoards(prev => prev.map(b => {
            if (b.id.toString() === boardA.id.toString()) {
                return {
                    ...b,
                    operations: [...(b.operations || []), dadoA],
                    rabbetJoint: { ...meta, partnerId: boardB.id.toString() },
                };
            }
            if (b.id.toString() === boardB.id.toString()) {
                return {
                    ...b,
                    size: newBSize,
                    position: newBPos,
                    operations: [...correctedBOps, dadoB],
                    rabbetJoint: { ...meta, partnerId: boardA.id.toString() },
                };
            }
            return b;
        }));
        showToast(`🔗 Rabbet joint applied: "${boardA.name}" over "${boardB.name}"`);
    },

    /**
     * Toggle (flip) an existing rabbet joint.
     * The previously "over" board becomes "under" (shrinks) and vice versa.
     * Strategy: remove the current joint, then re-apply with swapped roles.
     */
    toggleRabbetJoint: (boardId) => {
        const { boards, pushHistory, setBoards, showToast } = get();
        const board = boards.find(b => b.id.toString() === boardId.toString());
        if (!board?.rabbetJoint) return;

        const partner = boards.find(b => b.id.toString() === board.rabbetJoint.partnerId);
        if (!partner?.rabbetJoint) return;

        const { overBoardId, shrinkAxis, shrinkAmount, signA } = board.rabbetJoint;
        const currentOver = boards.find(b => b.id.toString() === overBoardId);
        const currentUnder = currentOver.id === board.id ? partner : board;
        if (!currentOver || !currentUnder) return;

        // ── 1. Restore the under board to its original size ───────────────
        const restoredUnderSize = [...currentUnder.size];
        const restoredUnderPos = [...currentUnder.position];
        restoredUnderSize[shrinkAxis] += shrinkAmount;
        const underSignA = currentUnder.rabbetJoint.signA;
        restoredUnderPos[shrinkAxis] -= underSignA * (shrinkAmount / 2);

        // ── 2. Remove old rabbet dados from both ──────────────────────────
        const stripRabbetDados = (ops, pid) =>
            (ops || []).filter(op => !(op.source === 'rabbet-joint' && op.partnerId === pid));

        // ── 3. Apply restored state (strip dados, restore sizes) ──────────
        pushHistory();
        setBoards(prev => prev.map(b => {
            if (b.id.toString() === currentUnder.id.toString()) {
                const cleaned = {
                    ...b,
                    size: restoredUnderSize,
                    position: restoredUnderPos,
                    operations: stripRabbetDados(b.operations, currentOver.id.toString()),
                };
                delete cleaned.rabbetJoint;
                return cleaned;
            }
            if (b.id.toString() === currentOver.id.toString()) {
                const cleaned = {
                    ...b,
                    operations: stripRabbetDados(b.operations, currentUnder.id.toString()),
                };
                delete cleaned.rabbetJoint;
                return cleaned;
            }
            return b;
        }));

        // ── 4. Re-apply with swapped roles (former under is now over) ─────
        // Use setTimeout to let state update, then call applyRabbetJoint
        setTimeout(() => {
            get().applyRabbetJoint(currentUnder.id, currentOver.id);
        }, 0);
    },

    /**
     * Remove a rabbet joint — restore the under board's size and remove
     * rabbet-tagged dados from both boards.
     */
    removeRabbetJoint: (boardId) => {
        const { boards, pushHistory, setBoards, showToast } = get();
        const board = boards.find(b => b.id.toString() === boardId.toString());
        if (!board?.rabbetJoint) return;

        const partner = boards.find(b => b.id.toString() === board.rabbetJoint.partnerId);
        if (!partner) return;

        const { overBoardId, shrinkAxis, shrinkAmount, signA } = board.rabbetJoint;
        const underBoard = boards.find(b => b.id.toString() !== overBoardId &&
            (b.id.toString() === board.id.toString() || b.id.toString() === partner.id.toString()));

        const stripRabbetDados = (ops, pid) =>
            (ops || []).filter(op => !(op.source === 'rabbet-joint' && op.partnerId === pid));

        pushHistory();
        setBoards(prev => prev.map(b => {
            const isBoard = b.id.toString() === board.id.toString();
            const isPartner = b.id.toString() === partner.id.toString();
            if (!isBoard && !isPartner) return b;

            const partnerId = isBoard ? partner.id.toString() : board.id.toString();
            const cleaned = {
                ...b,
                operations: stripRabbetDados(b.operations, partnerId),
            };
            delete cleaned.rabbetJoint;

            // Restore under board's size
            if (underBoard && b.id.toString() === underBoard.id.toString()) {
                cleaned.size = [...b.size];
                cleaned.position = [...b.position];
                cleaned.size[shrinkAxis] += shrinkAmount;
                cleaned.position[shrinkAxis] -= signA * (shrinkAmount / 2);
            }

            return cleaned;
        }));
        showToast(`🔗 Rabbet joint removed between "${board.name}" and "${partner.name}"`);
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

    // ─── Apply incremental rotation to a board (quaternion math) ──────────────
    // Applies rotation exactly along the board's LOCAL axis, avoiding gimbal lock.
    incrementRotation: (axis, degrees) => {
        const { selectedItemIds, pushHistory, boards, setBoards } = get();
        if (selectedItemIds.length === 0) return;
        pushHistory();
        const radians = (degrees * Math.PI) / 180;
        
        const axisVec = new THREE.Vector3();
        if (axis === 0) axisVec.set(1, 0, 0);
        if (axis === 1) axisVec.set(0, 1, 0);
        if (axis === 2) axisVec.set(0, 0, 1);
        
        const qInc = new THREE.Quaternion().setFromAxisAngle(axisVec, radians);

        setBoards(boards.map(b => {
            if (selectedItemIds.includes(b.id.toString())) {
                const currentEuler = new THREE.Euler(...(b.orientation || [0, 0, 0]), 'YXZ');
                const qCurrent = new THREE.Quaternion().setFromEuler(currentEuler);
                
                // Multiply applies the rotation LOCALLY
                qCurrent.multiply(qInc);
                
                const newEuler = new THREE.Euler().setFromQuaternion(qCurrent, 'YXZ');
                
                // Keep values wrapped inside reasonable bounds slightly (to avoid drifting)
                let x = newEuler.x;
                let y = newEuler.y;
                let z = newEuler.z;
                
                return { ...b, orientation: [x, y, z] };
            }
            return b;
        }));
    },

    // ─── Reset orientation on selected boards to [0,0,0] ─────────────────────
    resetRotation: () => {
        const { selectedItemIds, pushHistory, boards, setBoards } = get();
        if (selectedItemIds.length === 0) return;
        pushHistory();
        setBoards(boards.map(b =>
            selectedItemIds.includes(b.id.toString())
                ? { ...b, orientation: [0, 0, 0] }
                : b
        ));
    },

    // ─── applyRotation removed — local orientation model ──────────────────────
    // Operations (miter, dado, hole, etc.) are defined in LOCAL board space.
    // Rotating a board only changes its `orientation` Euler — no baking, no
    // axis/face remapping.  The old applyRotation bake-rotation logic has been
    // intentionally deleted as part of the local-orientation migration.

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

    // ─── Legacy SI Processor ─────────────────────────────────────────────────
    processSiCommand: (text) => {
        const { pushHistory, selectedItemIds, setBoards, setGroups, setSelectedItemIds, boards, groups, constraints, defaultMaterial, globalBounds, setChatMessages, setShowAiHelpDialog } = get();
        pushHistory();
        const lower = text.toLowerCase();
        let reply = "I've processed your request.";
        let updated = false;

        // ── Help / Cheat Sheet ───────────────────────────────────────────────
        if (/(help|what can you do|cheat sheet|command|syntax|\bhow \b)/.test(lower)) {
            setShowAiHelpDialog(true);
            reply = "I've popped open the command cheat sheet for you!";
            setTimeout(() => {
                setChatMessages(prev => [...prev, { role: 'ai', text: reply }]);
            }, 300);
            return;
        }

        // Parses plain decimals, pure fractions (3/8), and mixed numbers (1 3/8)
        const parseMeasurement = (str) => {
            if (!str) return null;
            const mixed = str.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
            if (mixed) {
                const whole = parseInt(mixed[1]);
                const frac  = parseInt(mixed[2]) / parseInt(mixed[3]);
                return whole + (whole < 0 ? -frac : frac);
            }
            const frac = str.match(/^(-?)(\d+)\/(\d+)$/);
            if (frac) return (frac[1] === '-' ? -1 : 1) * parseInt(frac[2]) / parseInt(frac[3]);
            const v = parseFloat(str);
            return isNaN(v) ? null : v;
        };

        // Finds first measurement token (decimal, fraction, or mixed number) in the lowercased text
        const extractMeasurement = (s) => {
            const m = s.match(/(-?\d+\s+\d+\/\d+|-?\d+\/\d+|-?\d*\.?\d+)/);
            return m ? parseMeasurement(m[1]) : null;
        };

        // ── Material change ──────────────────────────────────────────────────
        const allWoods = Object.entries(WOOD_CATALOGUE).map(([id, spec]) => ({ id, label: spec.label.toLowerCase(), type: 'wood' }));
        const allPaints = PAINT_PALETTE.map(({ hex, label }) => ({ hex, label: label.toLowerCase(), type: 'color' }));
        const allMats = [...allWoods, ...allPaints].sort((a, b) => b.label.length - a.label.length);
        
        const matchedMat = allMats.find(m => lower.includes(m.label));
        
        if (matchedMat) {
            const matDesc = matchedMat.type === 'wood' 
                ? { type: 'wood', id: matchedMat.id }
                : { type: 'color', hex: matchedMat.hex };
                
            setBoards(prev => prev.map(b => (selectedItemIds.length > 0 ? (selectedItemIds.includes(b.id.toString()) ? { ...b, material: matDesc } : b) : { ...b, material: matDesc })));
            
            const displayLabel = matchedMat.label.replace(/\b\w/g, l => l.toUpperCase());
            reply = selectedItemIds.length > 0 ? `Changed selected to ${displayLabel}.` : `Changed all to ${displayLabel}.`;
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

            const match = lower.match(/(-?\d+\s+\d+\/\d+|-?\d+\/\d+|-?[\d.]+)/);
            if (match) val = parseMeasurement(match[1]) * (val < 0 ? -1 : 1);

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

        // ── Tapered leg — add / convert / partial ──────────────────────────
        } else if ((lower.includes('taper') || lower.includes('tapered')) && (lower.includes('leg') || lower.includes('add') || lower.includes('make') || lower.includes('convert'))) {
            const angleMatch = lower.match(/(\d*\.?\d+)\s*(?:deg|°|degree)/i);
            const az = angleMatch ? parseFloat(angleMatch[1]) : 2;
            const ax = /dual|both|side/.test(lower) ? az : 0;

            if (/halfway|half way|partial|lower half|bottom half/.test(lower)) {
                // Partial taper: box upper + tapered lower, glued together
                const totalH = 30, t = 1.5, halfH = totalH / 2;
                const newGroupId = 'Tapered Leg ' + Math.floor(Math.random() * 1000);
                const upperId = Date.now(), lowerId = upperId + 1;
                setGroups(prev => ({
                    ...prev,
                    [newGroupId]: { parentId: 'Workspace', isExpanded: true, visible: true }
                }));
                const upperBoard = { id: upperId, name: 'Leg Upper', parentId: newGroupId, size: [t, halfH, t], position: [0, halfH + halfH / 2, 0], material: defaultMaterial, joint: 'None', operations: [] };
                const lowerBoard = {
                    id: lowerId, name: 'Leg Lower', parentId: newGroupId,
                    shape: 'taper', taper: { angleLeft: ax, angleRight: ax, angleFront: az, angleBack: az },
                    size: [t, halfH, t], position: [0, halfH / 2, 0],
                    material: defaultMaterial, joint: 'None', operations: [],
                    note: 'One piece; taper lower ' + halfH + '" only.'
                };
                const glueId = (Date.now() + 2).toString();
                setBoards(prev => [...prev, upperBoard, lowerBoard]);
                get().setConstraints(prev => ({ ...prev, [glueId]: { type: 'Glue', boardAId: upperId.toString(), boardBId: lowerId.toString(), offset: [0, halfH, 0], enabled: true } }));
                setSelectedItemIds([newGroupId]);
                reply = 'Partial-tapered leg: ' + halfH + '" straight upper + ' + halfH + '" tapered lower (' + az + '° back), glued as one unit.';
                updated = true;

            } else if (/make|convert|change/.test(lower) && selectedItemIds.length > 0) {
                setBoards(prev => prev.map(b =>
                    selectedItemIds.includes(b.id.toString())
                        ? { ...b, shape: 'taper', taper: { angleLeft: ax, angleRight: ax, angleFront: az, angleBack: az } } : b
                ));
                reply = 'Converted to tapered — back ' + az + '°' + (ax > 0 ? ', side ' + ax + '°' : '') + '.';
                updated = true;

            } else {
                const newId = Date.now();
                setBoards(prev => [...prev, {
                    id: newId, name: 'Tapered Leg', parentId: 'Workspace',
                    shape: 'taper', taper: { angleLeft: ax, angleRight: ax, angleFront: az, angleBack: az },
                    size: [1.5, 30, 1.5], position: [0, 15, 0],
                    material: defaultMaterial, joint: 'None', operations: []
                }]);
                setSelectedItemIds([newId.toString()]);
                reply = 'Added 1.5×30×1.5" tapered leg — back ' + az + '°' + (ax > 0 ? ', side ' + ax + '°' : '') + '. Bounding box unchanged.';
                updated = true;
            }

        // ── Add leg ──────────────────────────────────────────────────────────
        // ── Add/drill hole operation on selected board ───────────────────────
        } else if (selectedItemIds.length > 0 && /(drill|bore|add).*(hole|pocket)|(hole|pocket).*(drill|bore|add)/i.test(lower)) {
            const r = extractMeasurement(lower) ?? 1;
            let axis = 'y';
            if (/(through x|along x|\bx axis\b)/.test(lower)) axis = 'x';
            else if (/(through z|along z|\bz axis\b)/.test(lower)) axis = 'z';
            const op = { id: Date.now(), type: 'hole', radius: Math.abs(r), offsetX: 0, offsetY: 0, axis };
            setBoards(prev => prev.map(b =>
                selectedItemIds.includes(b.id.toString())
                    ? { ...b, operations: [...(b.operations || []), op] }
                    : b
            ));
            reply = `Added ${r}" radius hole (${axis}-axis) to ${selectedItemIds.length} board(s). Adjust offset in the Inspector.`;
            updated = true;

        // ── Add cove operation on selected board ──────────────────────────────
        } else if (selectedItemIds.length > 0 && /(add|cut|make).*(cove|hollow)|(cove|hollow).*(add|cut|make)/i.test(lower)) {
            const depth = extractMeasurement(lower) ?? 1;
            let edge = 'top';
            if (/bottom/.test(lower)) edge = 'bottom';
            else if (/left/.test(lower)) edge = 'left';
            else if (/right/.test(lower)) edge = 'right';
            let axis = 'y';
            if (/(\bx axis\b|along x)/.test(lower)) axis = 'x';
            else if (/(\bz axis\b|along z)/.test(lower)) axis = 'z';
            const op = { id: Date.now(), type: 'cove', edge, depth: Math.abs(depth), axis };
            setBoards(prev => prev.map(b =>
                selectedItemIds.includes(b.id.toString())
                    ? { ...b, operations: [...(b.operations || []), op] }
                    : b
            ));
            reply = `Added ${depth}" ${edge}-edge cove to ${selectedItemIds.length} board(s).`;
            updated = true;

        // ── Add arc operation on selected board ───────────────────────────────
        } else if (selectedItemIds.length > 0 && /(add|make|cut).*(arc|curve|cutout)|(arc|curve|cutout).*(add|make|cut)/i.test(lower)) {
            const angleMatch = lower.match(/(\d+)\s*(?:to|-|through)\s*(\d+)/);
            const startAngle = angleMatch ? parseInt(angleMatch[1]) : 0;
            const endAngle   = angleMatch ? parseInt(angleMatch[2]) : 90;
            let axis = 'y';
            if (/(\bx axis\b|along x)/.test(lower)) axis = 'x';
            else if (/(\bz axis\b|along z)/.test(lower)) axis = 'z';
            const op = { id: Date.now(), type: 'arc', startAngle, endAngle, innerRadius: 0, axis };
            setBoards(prev => prev.map(b =>
                selectedItemIds.includes(b.id.toString())
                    ? { ...b, operations: [...(b.operations || []), op] }
                    : b
            ));
            reply = `Added arc modifier (${startAngle}°–${endAngle}°, ${axis}-axis) to ${selectedItemIds.length} board(s).`;
            updated = true;

        } else if (lower.includes('add') && lower.includes('leg')) {
            const newId = Date.now();
            setBoards(prev => [...prev, { id: newId, name: 'New Leg', parentId: 'Workspace', size: [1.5, 12, 1.5], position: [0, 6, 0], material: defaultMaterial, joint: 'Butt 1', operations: [] }]);
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
                    joint: 'None', operations: []
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
                operations: [],
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
                joint: 'None',
                operations: [],
            }));

            setBoards(prev => [...prev, ...newBoards]);
            setSelectedItemIds([newGroupId]);
            reply = `Generated ${newHeight}" box (${newWidth}×${newDepth}) sitting on floor.`;
            updated = true;

        // ── Resize (cut/add/length/width/thickness) ──────────────────────────
        } else if (/(cut|add|trim|extend|shave|chop|short|shorter|long|wide|narrow|thick|thin|reduce|increase|shrink|grow|length|width|thickness|decrease|wider|thicker|longer|tall|taller)/.test(lower)) {
            const val = extractMeasurement(lower);
            if (val !== null) {

                // "taller" / "shorter" = world-space height (Y axis, index 1) — not sorted dims
                const isTall   = /(taller|tall)/.test(lower) && !/(length|longer|long)/.test(lower);
                const isShorter = /\bshorter\b/.test(lower) && !/(length|longer|long)/.test(lower);

                const isNegative = isShorter || /(cut|trim|shave|chop|short|narrow|thin|reduce|shrink|decrease)/.test(lower);
                const delta = isNegative ? -val : val;

                // "longer" / "length" / "short" = sorted longest dim; "taller/shorter" handled above
                const isLength    = !isTall && !isShorter && /(long|length|longer)/.test(lower);
                const isWidth     = /(wide|narrow|width|wider)/.test(lower);
                const isThickness = /(thick|thin|thicker|thinner|thickness)/.test(lower);

                let targetedBoards = selectedItemIds.length > 0 ? boards.filter(b => selectedItemIds.includes(b.id.toString())) : [];

                if (targetedBoards.length === 0) {
                    targetedBoards = boards.filter(b => lower.includes(b.name.toLowerCase()));
                }

                if (targetedBoards.length > 0) {
                    const targetIds = targetedBoards.map(b => b.id.toString());

                    setBoards(prev => prev.map(b => {
                        if (targetIds.includes(b.id.toString())) {
                            let dims = [
                                { idx: 0, val: b.size[0] },
                                { idx: 1, val: b.size[1] },
                                { idx: 2, val: b.size[2] }
                            ];
                            dims.sort((a, c) => c.val - a.val);

                            let targetIndex;
                            if (isTall || isShorter)        targetIndex = 1;             // world Y = up/down
                            else if (isLength)              targetIndex = dims[0].idx;   // sorted longest
                            else if (isWidth)               targetIndex = dims[1].idx;   // sorted middle
                            else if (isThickness)           targetIndex = dims[2].idx;   // sorted smallest
                            else {
                                // Axis-color / direction words
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

                    const dimLabel = (isTall || isShorter) ? 'height (Y)' : isLength ? 'length' : isWidth ? 'width' : 'thickness';
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
        // ── Rotate ───────────────────────────────────────────────────────────
        } else if (/(rotat|spin|turn|flip|orient)/.test(lower)) {
            const degrees = extractMeasurement(lower);
            if (degrees !== null) {

                // Axis detection: color names, axis letters, or semantic words
                let axis = 1; // default: Y (up/down spin is most common)
                if (/(right|left|red|\bx\b)/.test(lower)) axis = 0;
                else if (/(up|down|green|\by\b)/.test(lower)) axis = 1;
                else if (/(front|back|blue|\bz\b)/.test(lower)) axis = 2;

                let targetedBoards = selectedItemIds.length > 0
                    ? boards.filter(b => selectedItemIds.includes(b.id.toString()))
                    : boards.filter(b => lower.includes(b.name.toLowerCase()));

                if (targetedBoards.length > 0) {
                    const targetIds = targetedBoards.map(b => b.id.toString());
                    const radians = (degrees * Math.PI) / 180;
                    pushHistory();
                    setBoards(boards.map(b => {
                        if (!targetIds.includes(b.id.toString())) return b;
                        const ori = [...(b.orientation || [0, 0, 0])];
                        // 'flip' sets absolute 180°; other commands are additive
                        if (/flip/.test(lower)) {
                            ori[axis] = ori[axis] === 0 ? Math.PI : 0;
                        } else {
                            ori[axis] = ori[axis] + radians;
                        }
                        return { ...b, orientation: ori };
                    }));
                    const axisLabel = ['X (Red)', 'Y (Green)', 'Z (Blue)'][axis];
                    reply = `Rotated ${targetIds.length} board(s) ${/flip/.test(lower) ? '180° (flipped)' : `${degrees}°`} on ${axisLabel}.`;
                    updated = true;
                } else {
                    reply = "Select a board first, or name it — e.g. 'rotate Leg A 90 on Y'.";
                    updated = true;
                }
            } else if (/reset/.test(lower)) {
                // "reset rotation"
                const targetIds = selectedItemIds;
                if (targetIds.length > 0) {
                    pushHistory();
                    setBoards(boards.map(b =>
                        targetIds.includes(b.id.toString()) ? { ...b, orientation: [0, 0, 0] } : b
                    ));
                    reply = `Rotation reset to 0° on ${targetIds.length} board(s).`;
                    updated = true;
                }
            } else {
                reply = "I didn't detect an angle! Try 'rotate 90 on Y' or 'rotate 45 on red'.";
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
        const { chatInput, setChatMessages, setChatInput, aiEngine } = get();
        if (chatInput.trim()) {
            setChatMessages(prev => [...prev, { role: 'user', text: chatInput }]);
            
            if (aiEngine === 'si') {
                get().processSiCommand(chatInput);
            } else {
                get().processGeminiCommand(chatInput);
            }
            
            setChatInput('');
        }
    },

    // ─── Gemini AI Processor ──────────────────────────────────────────────────
    processGeminiCommand: async (text) => {
        const { pushHistory, selectedItemIds, setBoards, setGroups, setSelectedItemIds, boards, groups, constraints, defaultMaterial, globalBounds, setChatMessages, setShowAiHelpDialog } = get();
        
        const lower = text.toLowerCase();
        if (/(help|what can you do|cheat sheet|command|syntax|\bhow \b)/.test(lower)) {
            setShowAiHelpDialog(true);
            setChatMessages(prev => [...prev, { role: 'ai', text: "I've popped open the command cheat sheet for you!" }]);
            return;
        }

        setChatMessages(prev => [...prev, { role: 'ai', text: "Thinking...", isThinking: true }]);

        try {
            const { parseUserIntent } = await import('../services/geminiService');
            
            // Pass a minimal snapshot for context
            const workspaceContext = {
                selectedItemIds,
                boards: boards.map(b => ({
                    id: b.id, name: b.name, size: b.size, position: b.position
                }))
            };

            const result = await parseUserIntent(text, workspaceContext);
            
            pushHistory(); // Commit to history before executing actions
            let processedActions = 0;

            if (result.actions && Array.isArray(result.actions)) {
                for (const action of result.actions) {
                    // Resolve TARGETS
                    let rawTargetIds = [];
                    if (action.target === 'all') {
                        rawTargetIds = get().boards.map(b => b.id.toString());
                    } else if (action.target === 'selected') {
                        rawTargetIds = get().selectedItemIds;
                    } else if (action.target) {
                        // Find by name
                        const searchName = action.target.toLowerCase();
                        const matchedBoards = get().boards.filter(b => b.name?.toLowerCase().includes(searchName)).map(b => b.id.toString());
                        const matchedGroups = Object.entries(get().groups).filter(([id, g]) => g.name?.toLowerCase().includes(searchName)).map(([id]) => id);
                        rawTargetIds = [...matchedBoards, ...matchedGroups];
                    }

                    // Expand any group IDs into their descendant boards
                    const expandedSet = new Set();
                    rawTargetIds.forEach(id => {
                        if (get().groups[id]) {
                            const children = collectChildBoards(id, get().boards, get().groups);
                            children.forEach(c => expandedSet.add(c.id.toString()));
                        } else {
                            expandedSet.add(id);
                        }
                    });
                    const targetIds = Array.from(expandedSet);

                    // EXECUTE ACTION based on type
                    switch (action.type) {
                        case 'resize': {
                            if (!targetIds.length) break;
                            const delta = parseFloat(action.delta) || 0;
                            if (delta === 0) break;
                            
                            setBoards(prev => prev.map(b => {
                                if (!targetIds.includes(b.id.toString())) return b;
                                let dims = [
                                    { idx: 0, val: b.size[0] },
                                    { idx: 1, val: b.size[1] },
                                    { idx: 2, val: b.size[2] }
                                ];
                                dims.sort((a, c) => c.val - a.val);

                                let targetIndex = 2; // fallback thickness
                                if (action.dimension === 'height') targetIndex = 1; // world Y
                                else if (action.dimension === 'length') targetIndex = dims[0].idx;
                                else if (action.dimension === 'width') targetIndex = dims[1].idx;
                                else if (action.dimension === 'thickness') targetIndex = dims[2].idx;

                                let newSize = [...b.size];
                                newSize[targetIndex] = Math.max(0.1, newSize[targetIndex] + delta);
                                return { ...b, size: newSize };
                            }));
                            processedActions++;
                            break;
                        }
                        case 'move': {
                            if (!targetIds.length) break;
                            const delta = parseFloat(action.delta) || 0;
                            if (delta === 0) break;
                            
                            let axisIndex = 1;
                            if (action.axis === 'x') axisIndex = 0;
                            if (action.axis === 'z') axisIndex = 2;

                            const deltaVec = [0, 0, 0];
                            deltaVec[axisIndex] = delta;
                            
                            const moveMap = propagateMove(targetIds, deltaVec, get().constraints);

                            if (moveMap.size > 0) {
                                setBoards(prev => prev.map(b => {
                                    const d = moveMap.get(b.id.toString());
                                    if (d) return { ...b, position: [b.position[0] + d[0], b.position[1] + d[1], b.position[2] + d[2]] };
                                    return b;
                                }));
                                processedActions++;
                            }
                            break;
                        }
                        case 'rotate': {
                            if (!targetIds.length) break;
                            setBoards(prev => prev.map(b => {
                                if (!targetIds.includes(b.id.toString())) return b;
                                if (action.reset) {
                                    // Compensate position when clearing pivot
                                    const oldPiv = b.pivot || [0, 0, 0];
                                    return { ...b, orientation: [0,0,0], pivot: undefined,
                                        position: [b.position[0] - oldPiv[0], b.position[1] - oldPiv[1], b.position[2] - oldPiv[2]] };
                                }

                                // Resolve pivot preset name to [x, y, z] offset
                                let pivotUpdate = {};
                                let posUpdate = {};
                                if (action.pivot && action.pivot !== 'center') {
                                    const hx = b.size[0] / 2, hy = b.size[1] / 2, hz = b.size[2] / 2;
                                    const pivotMap = {
                                        'top':    [0,  hy, 0],   'bottom': [0, -hy, 0],
                                        'front':  [0, 0,  hz],   'back':   [0, 0, -hz],
                                        'right':  [ hx, 0, 0],   'left':   [-hx, 0, 0],
                                        'bottom-left-front':  [-hx, -hy,  hz],
                                        'bottom-right-front': [ hx, -hy,  hz],
                                        'bottom-left-back':   [-hx, -hy, -hz],
                                        'bottom-right-back':  [ hx, -hy, -hz],
                                        'top-left-front':     [-hx,  hy,  hz],
                                        'top-right-front':    [ hx,  hy,  hz],
                                        'top-left-back':      [-hx,  hy, -hz],
                                        'top-right-back':     [ hx,  hy, -hz],
                                    };
                                    const resolved = pivotMap[action.pivot];
                                    if (resolved) {
                                        const oldPiv = b.pivot || [0, 0, 0];
                                        const dx = resolved[0] - oldPiv[0], dy = resolved[1] - oldPiv[1], dz = resolved[2] - oldPiv[2];
                                        // For unrotated boards (most AI use cases), R=identity
                                        const [rx, ry, rz] = b.orientation || [0, 0, 0];
                                        let wx = dx, wy = dy, wz = dz;
                                        if (rx !== 0 || ry !== 0 || rz !== 0) {
                                            const ca = Math.cos(rx), sb = Math.sin(rx);
                                            const cc = Math.cos(ry), sd = Math.sin(ry);
                                            const ce = Math.cos(rz), sf = Math.sin(rz);
                                            wx = (cc*ce+sd*sf*sb)*dx + (sd*sb*ce-cc*sf)*dy + (ca*sd)*dz;
                                            wy = (ca*sf)*dx + (ca*ce)*dy + (-sb)*dz;
                                            wz = (cc*sf*sb-sd*ce)*dx + (sd*sf+cc*ce*sb)*dy + (ca*cc)*dz;
                                        }
                                        pivotUpdate = { pivot: [...resolved] };
                                        posUpdate = { position: [b.position[0] + wx, b.position[1] + wy, b.position[2] + wz] };
                                    }
                                }
                                
                                const ori = [...(b.orientation || [0,0,0])];
                                let axis = 1;
                                if (action.axis === 'x') axis = 0;
                                if (action.axis === 'z') axis = 2;
                                
                                if (action.flip) {
                                    ori[axis] = ori[axis] === 0 ? Math.PI : 0;
                                } else {
                                    ori[axis] += (parseFloat(action.degrees) * Math.PI) / 180;
                                }
                                return { ...b, orientation: ori, ...pivotUpdate, ...posUpdate };
                            }));
                            processedActions++;
                            break;
                        }
                        case 'material': {
                            if (!targetIds.length && action.target !== 'all') break;
                            const matDesc = action.materialType === 'color' 
                                ? { type: 'color', hex: action.value }
                                : { type: 'wood', id: action.value };
                            
                            setBoards(prev => prev.map(b => {
                                if (action.target === 'all' || targetIds.includes(b.id.toString())) {
                                    return { ...b, material: matDesc };
                                }
                                return b;
                            }));
                            processedActions++;
                            break;
                        }
                        case 'addTop': {
                            const targets = get().boards;
                            if (!targets.length) break;
                            const aabb = computeWorldAABB(targets);
                            const thickness = 0.75;
                            const newX = (aabb.minX + aabb.maxX) / 2;
                            const newZ = (aabb.minZ + aabb.maxZ) / 2;
                            const newY = aabb.maxY + thickness / 2;
                            const newId = Date.now();
                            setBoards(prev => [...prev, {
                                id: newId, name: 'Table Top', parentId: 'Workspace',
                                size: [Math.max(24, Math.abs(aabb.maxX - aabb.minX)), thickness, Math.max(16, Math.abs(aabb.maxZ - aabb.minZ))],
                                position: [newX, newY, newZ],
                                material: defaultMaterial, joint: 'None', operations: []
                            }]);
                            setSelectedItemIds([newId.toString()]);
                            processedActions++;
                            break;
                        }
                        case 'clone': {
                            if (!targetIds.length) break;
                            const count = parseInt(action.count) || 1;
                            let axisIndex = 1;
                            if (action.axis === 'x') axisIndex = 0;
                            if (action.axis === 'z') axisIndex = 2;
                            // Positive or negative gap? Assume positive unless explicitly negative.
                            const gap = parseFloat(action.gap) || 0;

                            let newClones = [];
                            const sourceBoards = get().boards.filter(b => targetIds.includes(b.id.toString()));
                            
                            sourceBoards.forEach((b, sIdx) => {
                                let currentPos = [...b.position];
                                for (let i = 1; i <= count; i++) {
                                    currentPos[axisIndex] += b.size[axisIndex] + gap;
                                    newClones.push({
                                        ...b,
                                        id: Date.now() + sIdx * 1000 + i,
                                        name: `${b.name} (Clone ${i})`,
                                        position: [...currentPos],
                                        operations: [] // omit operations to save performance on clones
                                    });
                                }
                            });
                            
                            const newIds = newClones.map(b => b.id.toString());
                            setBoards(prev => [...prev, ...newClones]);
                            setSelectedItemIds(newIds);
                            processedActions++;
                            break;
                        }
                        case 'addShelf': {
                            const targetBoards = targetIds.length > 0 
                                ? get().boards.filter(b => targetIds.includes(b.id.toString()))
                                : get().boards;
                            if (!targetBoards.length) break;

                            const parentId = targetBoards[0].parentId || 'Workspace';
                            const aabb = computeWorldAABB(targetBoards);
                            const thickness = 0.75;
                            
                            let effMinY = aabb.minY;
                            let effMaxY = aabb.maxY;

                            if (action.relativeBounds) {
                                if (action.relativeBounds.bottom) {
                                    if (action.relativeBounds.bottom.toLowerCase() === 'floor') {
                                        effMinY = 0;
                                    } else if (action.relativeBounds.bottom !== 'bottom') {
                                        const botName = action.relativeBounds.bottom.toLowerCase();
                                        const botBoard = get().boards.find(b => b.name?.toLowerCase().includes(botName));
                                        if (botBoard) {
                                            const botAabb = computeWorldAABB([botBoard]);
                                            effMinY = botAabb.maxY;
                                        }
                                    }
                                }
                                if (action.relativeBounds.top) {
                                    if (action.relativeBounds.top !== 'top') {
                                        const topName = action.relativeBounds.top.toLowerCase();
                                        const topBoard = get().boards.find(b => b.name?.toLowerCase().includes(topName));
                                        if (topBoard) {
                                            const topAabb = computeWorldAABB([topBoard]);
                                            effMaxY = topAabb.minY;
                                        }
                                    }
                                }
                            }
                            
                            let newY = (effMinY + effMaxY) / 2;
                            if (action.position === 'bottom') {
                                newY = effMinY + thickness / 2;
                            } else if (action.position === 'top') {
                                newY = effMaxY - thickness / 2;
                            } else if (typeof action.position === 'string' && action.position.includes('%')) {
                                const pct = parseFloat(action.position) / 100;
                                newY = effMinY + (effMaxY - effMinY) * pct;
                            } else if (typeof action.position === 'string' && action.position.includes('/')) {
                                const [num, den] = action.position.split('/');
                                const pct = parseFloat(num) / parseFloat(den);
                                newY = effMinY + (effMaxY - effMinY) * pct;
                            } else if (typeof action.position === 'number') {
                                newY = action.position;
                            }

                            const newX = (aabb.minX + aabb.maxX) / 2;
                            const newZ = (aabb.minZ + aabb.maxZ) / 2;
                            
                            const count = parseInt(action.count) || 1;
                            let newShelves = [];
                            const width = Math.abs(aabb.maxX - aabb.minX);
                            const depth = Math.abs(aabb.maxZ - aabb.minZ);
                            
                            if (count > 1) {
                                const span = effMaxY - effMinY;
                                const interval = span / (count + 1);
                                for (let i = 1; i <= count; i++) {
                                    newShelves.push({
                                        id: Date.now() + i, name: `Shelf ${i}`, parentId,
                                        size: [width, thickness, depth],
                                        position: [newX, effMinY + (interval * i), newZ],
                                        material: defaultMaterial, joint: 'None', operations: []
                                    });
                                }
                            } else {
                                newShelves.push({
                                    id: Date.now(), name: 'Shelf', parentId,
                                    size: [width, thickness, depth],
                                    position: [newX, newY, newZ],
                                    material: defaultMaterial, joint: 'None', operations: []
                                });
                            }

                            const newIds = newShelves.map(b => b.id.toString());
                            setBoards(prev => [...prev, ...newShelves]);
                            setSelectedItemIds(newIds);
                            processedActions++;
                            break;
                        }
                    }
                }
            }

            // Replace thinking bubble with results
            setChatMessages(prev => {
                const filt = prev.filter(m => !m.isThinking);
                return [...filt, { role: 'ai', text: result.reply || "Done!" }];
            });

        } catch (e) {
            setChatMessages(prev => {
                const filt = prev.filter(m => !m.isThinking);
                return [...filt, { role: 'ai', text: `Error: ${e.message}` }];
            });
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

        // Use orientation-aware AABB to find the true bottom Y
        const aabb = computeWorldAABB([selectedBoard]);
        const bottomY = aabb.minY;
        const delta = -bottomY; // shift so bottom sits at Y=0

        setBoards(boards.map(b => {
            if (selectedItemIds.includes(b.id.toString())) {
                return { ...b, position: [b.position[0], b.position[1] + delta, b.position[2]] };
            }
            return b;
        }));
    },

    dropGroupToFloor: () => {
        const { selectedItemIds, groups, pushHistory, boards, setBoards } = get();
        const selectedGroup = selectedItemIds.length === 1 && Object.keys(groups).find(k => k === selectedItemIds[0]);
        if (!selectedGroup) return;
        pushHistory();

        // Find the lowest Y extent of all child boards (orientation-aware)
        const childBoards = collectChildBoards(selectedGroup, boards, groups);
        if (childBoards.length === 0) return;

        const aabb = computeWorldAABB(childBoards);
        const lowestY = aabb.minY;

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

    // Drop the entire current multi-selection to the floor (works for any mix of boards and groups)
    dropSelectionToFloor: () => {
        const { selectedItemIds, boards, groups, pushHistory, setBoards } = get();
        if (selectedItemIds.length === 0) return;

        // Collect all boards in the selection (direct boards + children of selected groups)
        const boardSet = new Set();
        selectedItemIds.forEach(id => {
            const board = boards.find(b => b.id.toString() === id);
            if (board) {
                boardSet.add(board);
            } else if (groups[id]) {
                collectChildBoards(id, boards, groups).forEach(b => boardSet.add(b));
            }
        });

        const selBoards = Array.from(boardSet);
        if (selBoards.length === 0) return;

        // Find the lowest Y extent across all selected boards (orientation-aware)
        const aabb = computeWorldAABB(selBoards);
        const lowestY = aabb.minY;
        if (lowestY === Infinity) return;

        const delta = -lowestY; // shift so lowest point lands on Y=0
        if (delta === 0) return;

        pushHistory();
        const selIds = new Set(selBoards.map(b => b.id.toString()));
        setBoards(boards.map(b =>
            selIds.has(b.id.toString())
                ? { ...b, position: [b.position[0], b.position[1] + delta, b.position[2]] }
                : b
        ));
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

    manualAddCylinder: () => {
        const { selectedItemIds, boards, groups, setNewBoardDialog } = get();
        const selectedBoard = selectedItemIds.length === 1 && boards.find(b => b.id.toString() === selectedItemIds[0]);
        const selectedGroup = selectedItemIds.length === 1 && Object.keys(groups).find(k => k === selectedItemIds[0]);
        const targetParent = selectedGroup || (selectedBoard ? selectedBoard.parentId : 'Workspace');

        const radius = 0.875;    // 1.75" diameter — typical round furniture leg
        const height = 12;
        const diameter = radius * 2;
        setNewBoardDialog({
            name: 'Cylinder',
            parentId: targetParent,
            shape: 'cylinder',
            cylinder: { radius, axis: 'y' },
            sizeX: diameter,
            sizeY: height,
            sizeZ: diameter,
            position: [0, height / 2, 0],
        });
    },

    manualAddTaper: () => {
        const { selectedItemIds, boards, groups, setNewBoardDialog } = get();
        const selectedBoard = selectedItemIds.length === 1 && boards.find(b => b.id.toString() === selectedItemIds[0]);
        const selectedGroup = selectedItemIds.length === 1 && Object.keys(groups).find(k => k === selectedItemIds[0]);
        const targetParent = selectedGroup || (selectedBoard ? selectedBoard.parentId : 'Workspace');

        const w = 1.75, h = 12, d = 1.75;
        setNewBoardDialog({
            name: 'Tapered Leg',
            parentId: targetParent,
            shape: 'taper',
            taper: { angleLeft: 2, angleRight: 2, angleFront: 2, angleBack: 2 },
            sizeX: w,
            sizeY: h,
            sizeZ: d,
            position: [0, h / 2, 0],
        });
    },

    manualAddArc: () => {
        const { selectedItemIds, boards, groups, setNewBoardDialog } = get();
        const selectedBoard = selectedItemIds.length === 1 && boards.find(b => b.id.toString() === selectedItemIds[0]);
        const selectedGroup = selectedItemIds.length === 1 && Object.keys(groups).find(k => k === selectedItemIds[0]);
        const targetParent = selectedGroup || (selectedBoard ? selectedBoard.parentId : 'Workspace');

        const radius = 12; // 12" radius corner piece
        const thickness = 0.75; // 3/4" material
        setNewBoardDialog({
            name: 'Arc / Curve',
            parentId: targetParent,
            shape: 'arc',
            arc: { startAngle: 0, endAngle: 90, innerRadius: 0, axis: 'y' },
            sizeX: radius,
            sizeY: thickness,
            sizeZ: radius,
            position: [0, thickness / 2, 0],
        });
    },

    manualAddCove: () => {
        const { selectedItemIds, boards, groups, setNewBoardDialog } = get();
        const selectedBoard = selectedItemIds.length === 1 && boards.find(b => b.id.toString() === selectedItemIds[0]);
        const selectedGroup = selectedItemIds.length === 1 && Object.keys(groups).find(k => k === selectedItemIds[0]);
        const targetParent = selectedGroup || (selectedBoard ? selectedBoard.parentId : 'Workspace');

        const width = 12;
        const height = 4;
        const thickness = 0.75;
        setNewBoardDialog({
            name: 'Cove / Arch',
            parentId: targetParent,
            shape: 'cove',
            cove: { edge: 'top', depth: 2, axis: 'z' },
            sizeX: width,
            sizeY: height,
            sizeZ: thickness,
            position: [0, height / 2, 0],
        });
    },

    manualAddHole: () => {
        const { selectedItemIds, boards, groups, setNewBoardDialog } = get();
        const selectedBoard = selectedItemIds.length === 1 && boards.find(b => b.id.toString() === selectedItemIds[0]);
        const selectedGroup = selectedItemIds.length === 1 && Object.keys(groups).find(k => k === selectedItemIds[0]);
        const targetParent = selectedGroup || (selectedBoard ? selectedBoard.parentId : 'Workspace');

        const sizeX = 12, sizeY = 12, sizeZ = 0.75;
        setNewBoardDialog({
            name: 'Panel with Hole',
            parentId: targetParent,
            shape: 'hole',
            hole: { radius: 2, offsetX: 0, offsetY: 0, axis: 'z' },
            sizeX, sizeY, sizeZ,
            position: [0, sizeY / 2, 0],
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

    // ─── Cabinet Builder ──────────────────────────────────────────────────────
    // Creates a 6-panel cabinet assembly with:
    //   • Top / Bottom: full width, overlap sides (for dado joints)
    //   • Left / Right: full height, sit inside the top/bottom width
    //   • Front / Back: full width × height, flush-attached (no overlap), add to total depth
    //   • Back-bottom-left corner at world origin (0,0,0)
    buildCabinet: (cfg) => {
        const { pushHistory, setBoards, setGroups, setSelectedItemIds, defaultMaterial } = get();
        pushHistory();

        const W      = cfg.width ?? 24;
        const H      = cfg.height ?? 30;
        const D      = cfg.depth ?? 14;
        const tTB    = cfg.thicknessTB ?? 0.5;
        const tSide  = cfg.thicknessSide ?? 0.5;
        const tFront = cfg.thicknessFront ?? 0.5;
        const tBack  = cfg.thicknessBack ?? 0.25;

        // Core depth = depth between front and back panels
        const coreD = D - tFront - tBack;

        // Create assembly group
        const groupId = 'Cabinet ' + Math.floor(Math.random() * 1000);
        setGroups(prev => ({
            ...prev,
            [groupId]: { parentId: 'Workspace', isExpanded: true, visible: true }
        }));

        // Panel definitions — position is CENTER of each board
        // Coordinate system: X = left/right, Y = up/down, Z = front/back
        // Origin at back-bottom-left → cabinet extends (+X, +Y, +Z)
        //   Back face at Z = 0..tBack
        //   Core from Z = tBack..tBack+coreD
        //   Front face at Z = tBack+coreD..D
        const coreMidZ = tBack + coreD / 2;

        const panelDefs = [
            // Bottom: full width, sits at bottom of core
            { name: 'Bottom',     size: [W, tTB, coreD],      position: [W / 2, tTB / 2, coreMidZ] },
            // Top: full width, sits at top of core
            { name: 'Top',        size: [W, tTB, coreD],      position: [W / 2, H - tTB / 2, coreMidZ] },
            // Left side: full height, inset between top/bottom width (overlap at corners for dado)
            { name: 'Left Side',  size: [tSide, H, coreD],    position: [tSide / 2, H / 2, coreMidZ] },
            // Right side: full height, inset (same overlap logic)
            { name: 'Right Side', size: [tSide, H, coreD],    position: [W - tSide / 2, H / 2, coreMidZ] },
            // Back: full width × height, flush at Z = 0
            { name: 'Back',       size: [W, H, tBack],        position: [W / 2, H / 2, tBack / 2] },
            // Front: full width × height, flush at Z = D
            { name: 'Front',      size: [W, H, tFront],       position: [W / 2, H / 2, D - tFront / 2] },
        ];

        const baseId = Date.now();
        const newBoards = panelDefs.map((pd, i) => ({
            id: baseId + i,
            name: pd.name,
            parentId: groupId,
            size: pd.size,
            position: pd.position,
            material: defaultMaterial,
            joint: 'None',
            shape: 'box',
            operations: [],
        }));

        setBoards(prev => [...prev, ...newBoards]);
        setSelectedItemIds([groupId]);
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

        // Carry through base shapes (box, taper, cylinder)
        const boardShape    = newBoardDialog.shape;
        const boardTaper    = newBoardDialog.taper;
        const boardCylinder = newBoardDialog.cylinder;
        
        // Translate cutting shapes into operations
        const boardArc      = newBoardDialog.arc;
        const boardCove     = newBoardDialog.cove;
        const boardHole     = newBoardDialog.hole;

        const operations = [];
        if (boardArc)  operations.push({ id: Date.now() + 1, type: 'arc',  ...boardArc });
        if (boardCove) operations.push({ id: Date.now() + 2, type: 'cove', ...boardCove });
        if (boardHole) operations.push({ id: Date.now() + 3, type: 'hole', ...boardHole });

        let finalShape = boardShape || 'box';
        if (['arc', 'cove', 'hole'].includes(finalShape)) {
             finalShape = 'box';
        }

        setBoards(prev => [...prev, {
            id: newId,
            name: newBoardDialog.name || 'New Component',
            parentId: newBoardDialog.parentId,
            size: [newBoardDialog.sizeX, newBoardDialog.sizeY, newBoardDialog.sizeZ],
            position: newBoardDialog.position,
            material: defaultMaterial,
            joint: 'None',
            shape: finalShape,
            operations,
            ...(boardTaper    ? { taper: boardTaper }       : {}),
            ...(boardCylinder ? { cylinder: boardCylinder } : {}),
        }]);
        setSelectedItemIds([newId.toString()]);
        setNewBoardDialog(null);
    },

});
