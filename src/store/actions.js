import * as THREE from 'three';
import { getGlobalMatrix, getParentRotMatrix, collectChildBoards } from '../utils/sceneGraph';
import { solveAlignmentConstraint, getConstraintConnectedSet } from '../utils/constraintSolver';

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
        if (newRecents.length > 5) newRecents = newRecents.slice(0, 5); // Keep top 5
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
            const cur = prev[groupId] || { rotation: [0, 0, 0], position: [0, 0, 0] };
            return { ...prev, [groupId]: { ...cur, visible: cur.visible === false ? true : false } };
        });
    },

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

    updateGroupVector: (groupId, key, index, value) => {
        const { setGroups, groups, boards, setBoards } = get();
        const parsedVal = parseFloat(value) * (key === 'rotation' ? Math.PI / 180 : 1) || 0;

        setGroups(prev => {
            const cur = prev[groupId] || { rotation: [0, 0, 0], position: [0, 0, 0], visible: true };
            let newVec = [...cur[key]];
            newVec[index] = parsedVal;
            return { ...prev, [groupId]: { ...cur, [key]: newVec } };
        });

        if (key === 'position') {
            const oldVal = (groups[groupId]?.position || [0, 0, 0])[index];
            const localDelta = parsedVal - oldVal;
            if (localDelta === 0) return;

            const parentRotMat = getParentRotMatrix(groups[groupId]?.parentId, groups);
            const worldDelta = new THREE.Vector3(0, 0, 0);
            worldDelta.setComponent(index, localDelta);
            worldDelta.applyMatrix4(parentRotMat);

            const insideBoardIds = new Set();
            const collectChildren = (parentId) => {
                boards.forEach(b => { if (b.parentId === parentId) insideBoardIds.add(b.id.toString()); });
                Object.keys(groups).forEach(k => { if (groups[k].parentId === parentId) collectChildren(k); });
            };
            collectChildren(groupId);

            if (insideBoardIds.size === 0) return;

            let externalLinkedIds = new Set();
            let frontier = new Set(insideBoardIds); // used? NO
            let visited = new Set(insideBoardIds);
            let changed = true;
            while (changed) {
                changed = false;
                boards.forEach(b => {
                    const bid = b.id.toString();
                    if (visited.has(bid)) return;
                    if (b.constraints && b.constraints.some(c => c.enabled !== false && visited.has(c.targetId.toString()))) {
                        visited.add(bid);
                        externalLinkedIds.add(bid);
                        changed = true;
                    }
                });
                boards.forEach(b => {
                    const bid = b.id.toString();
                    if (!visited.has(bid)) return;
                    if (b.constraints) {
                        b.constraints.forEach(c => {
                            const tid = c.targetId.toString();
                            if (c.enabled !== false && !visited.has(tid)) {
                                visited.add(tid);
                                externalLinkedIds.add(tid);
                                changed = true;
                            }
                        });
                    }
                });
            }

            insideBoardIds.forEach(id => externalLinkedIds.delete(id));

            if (externalLinkedIds.size === 0) return;

            setBoards(prev => prev.map(b => {
                if (externalLinkedIds.has(b.id.toString())) {
                    const parentInv = getParentRotMatrix(b.parentId, groups).clone().invert();
                    const localShift = worldDelta.clone().applyMatrix4(parentInv);
                    return {
                        ...b,
                        position: [
                            b.position[0] + localShift.x,
                            b.position[1] + localShift.y,
                            b.position[2] + localShift.z
                        ]
                    };
                }
                return b;
            }));
        }
    },


    processAiCommand: (text) => {
        const { pushHistory, selectedItemIds, setBoards, setGroups, boards, groups, defaultMaterial, globalBounds, setChatMessages } = get();
        pushHistory();
        const lower = text.toLowerCase();
        let reply = "I've processed your spatial request.";
        let updated = false;

        if (lower.includes('walnut') || lower.includes('pine') || lower.includes('cherry') || lower.includes('oak')) {
            const mat = ['walnut', 'pine', 'cherry', 'red-oak', 'white-oak'].find(m => lower.includes(m.replace('-', ' '))) || 'walnut';
            setBoards(prev => prev.map(b => (selectedItemIds.length > 0 ? (selectedItemIds.includes(b.id.toString()) ? { ...b, material: mat } : b) : { ...b, material: mat })));
            reply = selectedItemIds.length > 0 ? `Changed selected to ${mat}.` : `Changed all to ${mat}.`;
            updated = true;
        } else if ((lower.includes('nudge') || lower.includes('move')) && selectedItemIds.length > 0) {
            let axis = 1;
            let val = 1;
            if (lower.includes('left') || lower.includes('right') || lower.includes('x')) axis = 0;
            if (lower.includes('forward') || lower.includes('back') || lower.includes('z')) axis = 2;

            if (lower.includes('down') || lower.includes('left') || lower.includes('back')) val = -1;

            const match = lower.match(/([+-]?\d*\.?\d+)/);
            if (match) val = parseFloat(match[1]) * (val < 0 ? -1 : 1);

            const movingIds = getConstraintConnectedSet(selectedItemIds, boards);

            setGroups(prev => {
                let nextConf = { ...prev };
                for (let id of selectedItemIds) {
                    if (nextConf[id]) {
                        let curConf = nextConf[id];

                        let t_global = new THREE.Vector3();
                        t_global.setComponent(axis, val);
                        let localTranslation = t_global.applyMatrix4(getParentRotMatrix(curConf.parentId, prev).invert());

                        let n = [...curConf.position];
                        n[0] += localTranslation.x;
                        n[1] += localTranslation.y;
                        n[2] += localTranslation.z;
                        nextConf[id] = { ...curConf, position: n };
                    }
                }
                return nextConf;
            });

            setBoards(prev => prev.map(b => {
                if (movingIds.has(b.id.toString())) {
                    let t_global = new THREE.Vector3();
                    t_global.setComponent(axis, val);
                    let localTranslation = t_global.applyMatrix4(getParentRotMatrix(b.parentId, groups).invert());

                    let n = [...b.position];
                    n[0] += localTranslation.x;
                    n[1] += localTranslation.y;
                    n[2] += localTranslation.z;
                    return { ...b, position: n };
                }
                return b;
            }));
            reply = `Globally translated ${movingIds.size} restricted component(s) by ${val} inches.`;
            updated = true;
        } else if (lower.includes('add') && lower.includes('leg')) {
            const newId = Date.now();
            setBoards(prev => [...prev, { id: newId, name: 'New Leg', parentId: 'Workspace', size: [1.5, 12, 1.5], position: [0, 0, 0], rotation: [0, 0, 0], material: defaultMaterial, joint: 'Butt 1', constraints: [] }]);
            setSelectedItemIds([newId.toString()]);
            reply = `Added a new 1.5x1.5 leg directly to the root Workspace using default material (${defaultMaterial}).`;
            updated = true;
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
                reply = "I need some existing geometry selected to calculate exactly where a top should go!";
            } else {
                let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxY = -Infinity, minY = Infinity;

                targets.forEach(b => {
                    const w = b.size[0] / 2, h = b.size[1] / 2, d = b.size[2] / 2;
                    const corners = [
                        new THREE.Vector3(w, h, d), new THREE.Vector3(w, h, -d), new THREE.Vector3(w, -h, d), new THREE.Vector3(w, -h, -d),
                        new THREE.Vector3(-w, h, d), new THREE.Vector3(-w, h, -d), new THREE.Vector3(-w, -h, d), new THREE.Vector3(-w, -h, -d)
                    ];

                    const mat = getGlobalMatrix(b.id.toString(), true, boards, groups);

                    corners.forEach(v => {
                        v.applyMatrix4(mat);
                        if (v.x < minX) minX = v.x;
                        if (v.x > maxX) maxX = v.x;
                        if (v.z < minZ) minZ = v.z;
                        if (v.z > maxZ) maxZ = v.z;
                        if (v.y > maxY) maxY = v.y;
                        if (v.y < minY) minY = v.y;
                    });
                });

                let newWidth = Math.abs(maxX - minX);
                let newDepth = Math.abs(maxZ - minZ);
                const thickness = 0.75;

                if (newWidth < 3) newWidth = Math.max(newWidth, 24);
                if (newDepth < 3) newDepth = Math.max(newDepth, 16);

                const newX = minX + ((Math.abs(maxX - minX)) / 2);
                const newZ = minZ + ((Math.abs(maxZ - minZ)) / 2);
                const finalY = maxY + (thickness / 2);

                let trimNotice = "";

                const geometricBase = minY !== Infinity ? minY : 0;
                const projectedAssemblyHeight = (maxY + thickness) - geometricBase;

                if (globalBounds.enabled && projectedAssemblyHeight > globalBounds.y) {
                    trimNotice = `\n\nWARNING: The generated Top extends to ${projectedAssemblyHeight.toFixed(2)}", which exceeds your workspace height limit of ${globalBounds.y}". You may want to manually move it or resize the legs.`;
                }

                const newId = Date.now();
                const pId = targets[0]?.parentId || 'Workspace';

                const pMatrix = getGlobalMatrix(pId, false, boards, groups);
                pMatrix.invert();

                const localPos = new THREE.Vector3(newX, finalY, newZ).applyMatrix4(pMatrix);
                const localEuler = new THREE.Euler().setFromRotationMatrix(pMatrix, 'XYZ');

                setBoards(prev => {
                    return [...prev, {
                        id: newId, name: 'Table Top', parentId: pId,
                        size: [newWidth, thickness, newDepth],
                        position: [localPos.x, localPos.y, localPos.z],
                        rotation: [localEuler.x, localEuler.y, localEuler.z],
                        material: defaultMaterial,
                        joint: 'None', constraints: []
                    }];
                });
                setSelectedItemIds([newId.toString()]);
                reply = `Generated dynamic Top plane!${trimNotice}`;
                updated = true;
            }
        } else if (/(cut|add|trim|extend|shave|chop|short|long|wide|narrow|thick|thin|reduce|increase|shrink|grow|length|width|thickness|decrease)/.test(lower)) {
            const match = lower.match(/(\d*\.?\d+)/);
            if (match) {
                const val = parseFloat(match[1]);
                const isNegative = /(cut|trim|shave|chop|short|narrow|thin|reduce|shrink|decrease)/.test(lower);
                const delta = isNegative ? -val : val;

                const isLength = /(short|long|length|tall|top|bottom)/.test(lower);
                const isWidth = /(wide|narrow|width|left|right)/.test(lower);

                let targetedBoards = selectedItemIds.length > 0 ? boards.filter(b => selectedItemIds.includes(b.id.toString())) : [];

                if (targetedBoards.length === 0) {
                    targetedBoards = boards.filter(b => lower.includes(b.name.toLowerCase()));
                }

                if (targetedBoards.length > 0) {
                    const targetIds = targetedBoards.map(b => b.id.toString());

                    setBoards(prev => prev.map(b => {
                        if (targetIds.includes(b.id.toString())) {
                            let targetGlobalNormal = null;
                            if (/(top|up)/.test(lower)) targetGlobalNormal = new THREE.Vector3(0, 1, 0);
                            else if (/(bottom|down)/.test(lower)) targetGlobalNormal = new THREE.Vector3(0, -1, 0);
                            else if (/(right)/.test(lower)) targetGlobalNormal = new THREE.Vector3(1, 0, 0);
                            else if (/(left)/.test(lower)) targetGlobalNormal = new THREE.Vector3(-1, 0, 0);
                            else if (/(front)/.test(lower)) targetGlobalNormal = new THREE.Vector3(0, 0, 1);
                            else if (/(back)/.test(lower)) targetGlobalNormal = new THREE.Vector3(0, 0, -1);

                            let targetIndex = 0;
                            let localSign = 1;

                            if (targetGlobalNormal) {
                                const mat = getGlobalMatrix(b.id.toString(), true, prev, groups);
                                const normalMatrix = new THREE.Matrix3().getNormalMatrix(mat);
                                let bestDot = -Infinity;
                                const faces = [
                                    { i: 0, sign: 1, v: new THREE.Vector3(1,0,0) }, { i: 0, sign: -1, v: new THREE.Vector3(-1,0,0) },
                                    { i: 1, sign: 1, v: new THREE.Vector3(0,1,0) }, { i: 1, sign: -1, v: new THREE.Vector3(0,-1,0) },
                                    { i: 2, sign: 1, v: new THREE.Vector3(0,0,1) }, { i: 2, sign: -1, v: new THREE.Vector3(0,0,-1) }
                                ];
                                faces.forEach(f => {
                                    const worldV = f.v.clone().applyMatrix3(normalMatrix).normalize();
                                    const d = worldV.dot(targetGlobalNormal);
                                    if (d > bestDot) {
                                        bestDot = d;
                                        targetIndex = f.i;
                                        localSign = f.sign;
                                    }
                                });
                            } else {
                                let dims = [ { idx: 0, val: b.size[0] }, { idx: 1, val: b.size[1] }, { idx: 2, val: b.size[2] } ];
                                dims.sort((a, c) => c.val - a.val);
                                targetIndex = dims[0].idx; 
                                if (isWidth) targetIndex = dims[1].idx;
                                else if (!isLength && !isWidth) targetIndex = dims[2].idx;
                            }

                            let newSize = [...b.size];
                            const actualDelta = Math.max(0.1 - newSize[targetIndex], delta);
                            newSize[targetIndex] += actualDelta;

                            let newPos = [...b.position];
                            if (targetGlobalNormal) {
                                let localOffset = new THREE.Vector3(0, 0, 0);
                                localOffset.setComponent(targetIndex, (actualDelta / 2) * localSign);
                                localOffset.applyEuler(new THREE.Euler(...(b.rotation || [0, 0, 0]), 'XYZ'));
                                newPos[0] += localOffset.x;
                                newPos[1] += localOffset.y;
                                newPos[2] += localOffset.z;
                            }

                            return { ...b, size: newSize, position: newPos };
                        }
                        return b;
                    }));

                    reply = `Dynamically re-scaled ${targetIds.length} element(s) with a ${delta > 0 ? '+' : ''}${delta}" shift.`;
                    updated = true;
                } else {
                    reply = "I don't know which board to resize! Please click on a component or say its exact name.";
                    updated = true;
                }
            } else {
                reply = "I didn't detect the exact numeric measurement! Try saying 'cut .75 inches off the bottom'.";
                updated = true;
            }
        } else if (lower.includes('rotate') && selectedItemIds.length > 0) {
            let axis = 1; 
            if (lower.includes('x-y') || lower.includes('xy plane')) axis = 2;
            else if (lower.includes('y-z') || lower.includes('yz plane')) axis = 0;
            else if (lower.includes('x-z') || lower.includes('xz plane')) axis = 1;
            else if (lower.includes(' x ') || lower.includes('x-axis') || lower.endsWith(' x') || lower.includes('red')) axis = 0;
            else if (lower.includes(' y ') || lower.includes('y-axis') || lower.endsWith(' y') || lower.includes('green')) axis = 1;
            else if (lower.includes(' z ') || lower.includes('z-axis') || lower.endsWith(' z') || lower.includes('blue')) axis = 2;

            let deg = 90;
            const match = lower.match(/(-?\d+)/);
            if (match) deg = parseInt(match[1]);

            let constraintViolation = null;
            const force = lower.includes('force') || lower.includes('break');

            for (let id of selectedItemIds) {
                const isGroup = groups[id] !== undefined;
                if (isGroup) continue;

                const b = boards.find(x => x.id.toString() === id);
                if (!b) continue;

                const hasMyConstraints = b.constraints && b.constraints.some(c => c.enabled !== false);
                const isTargetOfConstraints = boards.some(otherB =>
                    otherB.constraints && otherB.constraints.some(c => c.enabled !== false && c.targetId.toString() === id)
                );

                if ((hasMyConstraints || isTargetOfConstraints) && !force) {
                    constraintViolation = `Constraint Blocked: Component [${b.name}] has active constraints attached to it. You must clear its constraints to rotate it freely, or add "force" to bypass.`;
                    break;
                }
            }

            if (constraintViolation) {
                reply = constraintViolation;
            } else {
                let globalAxis = new THREE.Vector3();
                globalAxis.setComponent(axis, 1);
                let qRot = new THREE.Quaternion().setFromAxisAngle(globalAxis, deg * Math.PI / 180);

                setGroups(prev => {
                    let nextConf = { ...prev };
                    for (let id of selectedItemIds) {
                        if (nextConf[id]) {
                            let curConf = nextConf[id];
                            let parentMatrix = getParentRotMatrix(curConf.parentId, prev);
                            let parentQuat = new THREE.Quaternion().setFromRotationMatrix(parentMatrix);
                            let localQRot = parentQuat.clone().invert().multiply(qRot).multiply(parentQuat);

                            let q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(curConf.rotation || [0, 0, 0]), 'XYZ'));
                            q.premultiply(localQRot);
                            let e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
                            nextConf[id] = { ...curConf, rotation: [e.x, e.y, e.z] };
                        }
                    }
                    return nextConf;
                });

                setBoards(prev => prev.map(b => {
                    if (selectedItemIds.includes(b.id.toString())) {
                        let parentMatrix = getParentRotMatrix(b.parentId, groups);
                        let parentQuat = new THREE.Quaternion().setFromRotationMatrix(parentMatrix);
                        let localQRot = parentQuat.clone().invert().multiply(qRot).multiply(parentQuat);

                        let q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(b.rotation || [0, 0, 0]), 'XYZ'));
                        q.premultiply(localQRot);
                        let e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
                        return { ...b, rotation: [e.x, e.y, e.z] };
                    }
                    return b;
                }));
                reply = `Applied ${deg} degree rotation sequence.`;
                updated = true;
            }
        }

        if (!updated) {
            reply = "I need clearer spatial constraints. Try 'move selected down 1 inch' or 'change to cherry'.";
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

    dropGroupToFloor: () => {
        const { selectedItemIds, groups, pushHistory, boards, setGroups } = get();
        const selectedGroup = selectedItemIds.length === 1 && Object.keys(groups).find(k => k === selectedItemIds[0]);
        if (!selectedGroup) return;
        pushHistory();
        let lowestY = Infinity;
        const cb = [];
        const traverse = (pId) => {
            boards.filter(b => b.parentId === pId).forEach(b => cb.push(b));
            Object.keys(groups).filter(k => groups[k].parentId === pId).forEach(k => traverse(k));
        };
        traverse(selectedGroup);

        cb.forEach(b => {
            const mat = getGlobalMatrix(b.id.toString(), true, boards, groups);
            const w = b.size[0] / 2, h = b.size[1] / 2, d = b.size[2] / 2;
            const corners = [
                new THREE.Vector3(w, h, d), new THREE.Vector3(w, h, -d), new THREE.Vector3(w, -h, d), new THREE.Vector3(w, -h, -d),
                new THREE.Vector3(-w, h, d), new THREE.Vector3(-w, h, -d), new THREE.Vector3(-w, -h, d), new THREE.Vector3(-w, -h, -d)
            ];
            corners.forEach(v => { v.applyMatrix4(mat); if (v.y < lowestY) lowestY = v.y; });
        });

        if (lowestY === Infinity) return;
        const offset = new THREE.Vector3(0, -3 - lowestY, 0).applyMatrix4(getParentRotMatrix(groups[selectedGroup].parentId, groups).invert());

        setGroups(prev => {
            const cur = prev[selectedGroup];
            let p = cur.position || [0, 0, 0];
            return { ...prev, [selectedGroup]: { ...cur, position: [p[0] + offset.x, p[1] + offset.y, p[2] + offset.z] } };
        });
    },

    dropBoardToFloor: () => {
        const { selectedItemIds, boards, groups, pushHistory, setBoards } = get();
        const selectedBoard = selectedItemIds.length === 1 && boards.find(b => b.id.toString() === selectedItemIds[0]);
        if (!selectedBoard) return;
        pushHistory();

        let lowestY = Infinity;
        const mat = getGlobalMatrix(selectedBoard.id.toString(), true, boards, groups);
        const w = selectedBoard.size[0] / 2, h = selectedBoard.size[1] / 2, d = selectedBoard.size[2] / 2;
        const corners = [
            new THREE.Vector3(w, h, d), new THREE.Vector3(w, h, -d), new THREE.Vector3(w, -h, d), new THREE.Vector3(w, -h, -d),
            new THREE.Vector3(-w, h, d), new THREE.Vector3(-w, h, -d), new THREE.Vector3(-w, -h, d), new THREE.Vector3(-w, -h, -d)
        ];
        corners.forEach(v => { v.applyMatrix4(mat); if (v.y < lowestY) lowestY = v.y; });

        if (lowestY === Infinity) return;
        const offset = new THREE.Vector3(0, -3 - lowestY, 0).applyMatrix4(getParentRotMatrix(selectedBoard.parentId, groups).invert());

        setBoards(boards.map(b => {
            if (selectedItemIds.includes(b.id.toString())) {
                let p = b.position || [0, 0, 0];
                return { ...b, position: [p[0] + offset.x, p[1] + offset.y, p[2] + offset.z] };
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
            dimW: 12,
            dimL: 12,
            dimD: 0.75,
            plane: 'red-green',
            position: [0, 0, 0]
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
            [newId]: { parentId: targetParent, isExpanded: true, visible: true, position: [0, 0, 0], rotation: [0, 0, 0] }
        }));
        setSelectedItemIds([newId]);
    },

    handleNewBoardConfirm: () => {
        const { pushHistory, newBoardDialog, setBoards, defaultMaterial, setSelectedItemIds, setNewBoardDialog } = get();
        pushHistory();
        const newId = Date.now();
        let calculatedSize = [newBoardDialog.dimW, newBoardDialog.dimL, newBoardDialog.dimD];
        if (newBoardDialog.plane === 'red-blue') calculatedSize = [newBoardDialog.dimW, newBoardDialog.dimD, newBoardDialog.dimL];
        else if (newBoardDialog.plane === 'green-blue') calculatedSize = [newBoardDialog.dimD, newBoardDialog.dimW, newBoardDialog.dimL];

        setBoards(prev => [...prev, {
            id: newId, name: newBoardDialog.name || 'New Component', parentId: newBoardDialog.parentId,
            size: calculatedSize, position: newBoardDialog.position, rotation: [0, 0, 0],
            material: defaultMaterial, joint: 'None', constraints: []
        }]);
        setSelectedItemIds([newId.toString()]);
        setNewBoardDialog(null);
    },

});
