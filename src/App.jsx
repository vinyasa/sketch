import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import './index.css';
import './App.css';
import Viewport3D from './components/Viewport3D';

const getParentRotMatrix = (pId, currentGroups) => {
    let mat = new THREE.Matrix4();
    let cur = pId;
    while (cur) {
        const g = currentGroups[cur];
        if (g) {
            mat.premultiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...(g.rotation || [0, 0, 0]), 'XYZ')));
            cur = g.parentId;
        } else cur = null;
    }
    return mat;
};

const DraggablePanel = ({ title, defaultPosition, onFocusCapture, children, defaultSize = { width: 250 } }) => {
    const [pos, setPos] = useState(defaultPosition);
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef(null);

    const onPointerDown = (e) => {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON') {
            setIsDragging(true);
            dragRef.current = { startX: e.clientX, startY: e.clientY, posX: pos.x, posY: pos.y };
            e.target.setPointerCapture(e.pointerId);
            e.preventDefault();
        }
    };

    const onPointerMove = (e) => {
        if (!isDragging || !dragRef.current) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        setPos({ x: dragRef.current.posX + dx, y: dragRef.current.posY + dy });
    };

    const onPointerUp = (e) => {
        setIsDragging(false);
        e.target.releasePointerCapture(e.pointerId);
    };

    return (
        <div className="glass-panel" onFocusCapture={onFocusCapture} style={{
            position: 'absolute', left: pos.x, top: pos.y, width: defaultSize.width, maxHeight: '80%',
            padding: '10px', display: 'flex', flexDirection: 'column', borderRadius: '8px',
            zIndex: 100, pointerEvents: 'auto', resize: 'both', overflow: 'hidden', minWidth: '200px', minHeight: '100px',
            boxShadow: isDragging ? '0 16px 32px rgba(0,0,0,0.4)' : 'var(--shadow)'
        }}>
            <div
                className="draggable-handle"
                style={{
                    fontWeight: 600, fontSize: '0.85rem', marginBottom: '10px', cursor: isDragging ? 'grabbing' : 'grab',
                    margin: '-10px -10px 10px -10px', padding: '8px 10px', backgroundColor: 'rgba(0,0,0,0.15)', color: 'var(--accent-color)',
                    borderRadius: '8px 8px 0 0', borderBottom: '1px solid var(--border-color)', userSelect: 'none'
                }}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
            >
                {title}
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {children}
            </div>
        </div>
    );
};

export default function App() {
    const loadState = (key, def) => {
        try {
            const s = localStorage.getItem('lucey_save');
            if (s) {
                const p = JSON.parse(s);
                return p[key] !== undefined ? p[key] : def;
            }
        } catch (e) { }
        return def;
    };

    const [showCutlistPanel, setShowCutlistPanel] = useState(false);
    const [theme, setTheme] = useState(() => loadState('theme', 'light'));
    const [units, setUnits] = useState(() => loadState('units', 'imperial'));
    const [gridSnap, setGridSnap] = useState(() => loadState('gridSnap', '1/8 in'));
    const [defaultMaterial, setDefaultMaterial] = useState(() => loadState('defaultMaterial', 'pine'));
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
    const [rightMode, setRightMode] = useState('inspector');
    const [showEdges, setShowEdges] = useState(() => loadState('showEdges', true));
    const [showDimensions, setShowDimensions] = useState(() => loadState('showDimensions', true));
    const [showBoundingBox, setShowBoundingBox] = useState(() => loadState('showBoundingBox', true));
    const [showSettingsPanel, setShowSettingsPanel] = useState(false);

    const [globalBounds, setGlobalBounds] = useState(() => loadState('globalBounds', { enabled: false, x: 18, y: 25, z: 18 }));
    const [toast, setToast] = useState(null);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };

    const [selectedItemIds, setSelectedItemIds] = useState([]);
    const [constraintTargetMode, setConstraintTargetMode] = useState(null);
    const [newBoardDialog, setNewBoardDialog] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [fileMenuOpen, setFileMenuOpen] = useState(false);
    const [recentFiles, setRecentFiles] = useState(() => {
        try { return JSON.parse(localStorage.getItem('lucey_recent_files')) || []; }
        catch { return []; }
    });



    const [chatInput, setChatInput] = useState('');
    const [chatMessages, setChatMessages] = useState([
        { role: 'ai', text: 'Ready! Try saying "change completely to walnut" or select a board and say "move up 2 inches".' }
    ]);

    const [history, setHistory] = useState([]);
    const [redoHistory, setRedoHistory] = useState([]);

    const pushHistory = () => {
        setRedoHistory([]);
        setHistory(h => [...h, { boards, groups }].slice(-25));
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const last = history[history.length - 1];
        setRedoHistory(r => [...r, { boards, groups }]);
        setHistory(h => h.slice(0, -1));
        setBoards(last.boards);
        setGroups(last.groups);
    };

    const handleRedo = () => {
        if (redoHistory.length === 0) return;
        const next = redoHistory[redoHistory.length - 1];
        setHistory(h => [...h, { boards, groups }]);
        setRedoHistory(r => r.slice(0, -1));
        setBoards(next.boards);
        setGroups(next.groups);
    };

    const saveWorkspace = (isNamedSave = false) => {
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

        // Also save as default auto-load project
        localStorage.setItem('lucey_save', JSON.stringify(payload));
        showToast(`Saved layout to local storage`);
    };

    const loadWorkspace = (name) => {
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
    };

    const exportWorkspace = async () => {
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
    };

    const importWorkspace = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const p = JSON.parse(event.target.result);
                if (p.boards && p.groups) {
                    setBoards(p.boards);
                    setGroups(p.groups);
                    setHistory([]); // Reset undo stack on totally new file
                    setRedoHistory([]);
                }
            } catch (e) { alert("Failed to parse project file."); }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // Initialization default load is now managed purely via lazy state evaluation on mount.

    const [groups, setGroups] = useState(() => loadState('groups', {
        'Workspace': { parentId: null, position: [0, 0, 0], rotation: [0, 0, 0], visible: true, isExpanded: true },
        'Table Base': { parentId: 'Workspace', position: [0, 0, 0], rotation: [0, 0, 0], visible: true, isExpanded: true },
        'Supports': { parentId: 'Workspace', position: [0, 0, 0], rotation: [0, 0, 0], visible: true, isExpanded: true }
    }));

    const [boards, setBoards] = useState(() => loadState('boards', [
        { id: 1, name: 'Table Top', parentId: 'Table Base', size: [36, 6, 0.75], position: [0, 0, 0], rotation: [0, 0, 0], material: 'pine', joint: 'Butt 1', constraints: [] },
        { id: 2, name: 'Leg A', parentId: 'Table Base', size: [0.75, 6, 12], position: [17.625, 0, 2.625], rotation: [0, 0, 0], material: 'white-oak', joint: 'Miter', constraints: [{ type: 'Glue', targetId: 1, properties: 'Target: Bottom Face' }] },
        { id: 3, name: 'Leg B', parentId: 'Table Base', size: [0.75, 6, 12], position: [-17.625, 0, 2.625], rotation: [0, 0, 0], material: 'white-oak', joint: 'Miter', constraints: [{ type: 'Glue', targetId: 1, properties: 'Target: Bottom Face' }] },
        { id: 4, name: 'Cross Brace', parentId: 'Supports', size: [34.5, 2, 0.75], position: [0, -4, 2.625], rotation: [Math.PI / 2, 0, 0], material: 'cherry', joint: 'Dado', constraints: [{ type: 'Flush', targetId: 2, properties: 'Offset: 0in' }, { type: 'Flush', targetId: 3, properties: 'Offset: 0in' }] }
    ]));



    const getGlobalMatrix = (id, isBoard, currentBoards = boards, currentGroups = groups) => {
        let mat = new THREE.Matrix4();
        let cur = id; let isB = isBoard;
        while (cur) {
            let p = [0, 0, 0], r = [0, 0, 0], parentId = null;
            if (isB) {
                const b = currentBoards.find(x => x.id.toString() === cur);
                if (b) { p = b.position || [0, 0, 0]; r = b.rotation || [0, 0, 0]; parentId = b.parentId; }
                isB = false;
            } else {
                const g = currentGroups[cur];
                if (g) { p = g.position || [0, 0, 0]; r = g.rotation || [0, 0, 0]; parentId = g.parentId; }
            }
            mat.premultiply(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r, 'XYZ')), new THREE.Vector3(1, 1, 1)));
            cur = parentId;
        }
        return mat;
    };

    const solveAlignmentConstraint = (sourceBoard, constraintObj, currentBoards) => {
        const tBoard = currentBoards.find(b => b.id.toString() === constraintObj.targetId.toString());
        if (!tBoard) return null;

        const getLocalData = (board, face) => {
            let norm = new THREE.Vector3();
            let pos = new THREE.Vector3();
            const sign = face[1] === '+' ? 1 : -1;
            const w = board.size[0] / 2, h = board.size[1] / 2, d = board.size[2] / 2;
            if (face[0] === 'x') { norm.set(sign, 0, 0); pos.set(w * sign, 0, 0); }
            if (face[0] === 'y') { norm.set(0, sign, 0); pos.set(0, h * sign, 0); }
            if (face[0] === 'z') { norm.set(0, 0, sign); pos.set(0, 0, d * sign); }
            return { norm, pos };
        };

        const tLocal = getLocalData(tBoard, constraintObj.targetFace);
        const sLocal = getLocalData(sourceBoard, constraintObj.sourceFace);

        const tMat = getGlobalMatrix(tBoard.id.toString(), true, currentBoards);
        const sMat = getGlobalMatrix(sourceBoard.id.toString(), true, currentBoards);

        const tGlobalPos = tLocal.pos.applyMatrix4(tMat);
        const tGlobalNorm = tLocal.norm.applyMatrix4(new THREE.Matrix4().extractRotation(tMat)).normalize();

        const sGlobalPos = sLocal.pos.applyMatrix4(sMat);

        const targetNormal = constraintObj.type === 'Flush' ? tGlobalNorm : tGlobalNorm.clone().negate();

        const dist = new THREE.Vector3().subVectors(tGlobalPos, sGlobalPos).dot(targetNormal);
        const vShiftGlobal = targetNormal.clone().multiplyScalar(dist);

        const sCenterGlobal = new THREE.Vector3(0, 0, 0).applyMatrix4(sMat);
        sCenterGlobal.add(vShiftGlobal);

        const parentMat = getGlobalMatrix(sourceBoard.parentId, false, currentBoards);
        const parentMatInvert = parentMat.clone().invert();

        const newLocalPos = sCenterGlobal.applyMatrix4(parentMatInvert);

        return { position: [newLocalPos.x, newLocalPos.y, newLocalPos.z] };
    };

    const toggleSelection = (id, isMulti, faceStr = null) => {
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
                            const result = solveAlignmentConstraint(b, newConstraint, prev);
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
    };

    const updateSelectedBoards = (key, value) => {
        pushHistory();
        setBoards(boards.map(b => selectedItemIds.includes(b.id.toString()) ? { ...b, [key]: value } : b));
    };

    const toggleBoardVisibility = (id) => {
        setBoards(bds => bds.map(b => b.id === id ? { ...b, visible: b.visible === false ? true : false } : b));
    };

    const toggleGroupVisibility = (groupId) => {
        setGroups(prev => {
            const cur = prev[groupId] || { rotation: [0, 0, 0], position: [0, 0, 0] };
            return { ...prev, [groupId]: { ...cur, visible: cur.visible === false ? true : false } };
        });
    };

    const updateVector = (key, index, value) => {
        if (selectedItemIds.length === 0) return;
        pushHistory();

        const floatVal = parseFloat(value) || 0;

        let movingIds = new Set(selectedItemIds);
        if (key === 'position') {
            let added = true;
            while (added) {
                added = false;
                boards.forEach(b => {
                    if (b.constraints && b.constraints.some(c => c.enabled !== false && movingIds.has(c.targetId.toString()))) {
                        if (!movingIds.has(b.id.toString())) { movingIds.add(b.id.toString()); added = true; }
                    }
                    if (movingIds.has(b.id.toString()) && b.constraints) {
                        b.constraints.forEach(c => {
                            if (c.enabled !== false && !movingIds.has(c.targetId.toString())) { movingIds.add(c.targetId.toString()); added = true; }
                        });
                    }
                });
            }
        }

        setBoards(boards.map(b => {
            if (movingIds.has(b.id.toString())) {
                if (key === 'position') {
                    // Calculate delta if it's the directly selected one? Wait, `updateVector` receives absolute value for ONE component in Inspector usually.
                    // If multiple things are moving because of constraints, we need a delta, but updateVector sets an absolute value.
                    // This is tricky: `updateVector` sets `b.position[index] = value`.
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
    };

    const updateGroupVector = (groupId, key, index, value) => {
        const parsedVal = parseFloat(value) * (key === 'rotation' ? Math.PI / 180 : 1) || 0;

        // Update the group itself
        setGroups(prev => {
            const cur = prev[groupId] || { rotation: [0, 0, 0], position: [0, 0, 0], visible: true };
            let newVec = [...cur[key]];
            newVec[index] = parsedVal;
            return { ...prev, [groupId]: { ...cur, [key]: newVec } };
        });

        // If moving position, propagate to externally-constrained boards
        if (key === 'position') {
            const oldVal = (groups[groupId]?.position || [0, 0, 0])[index];
            const localDelta = parsedVal - oldVal;
            if (localDelta === 0) return;

            // Convert local delta to world-space delta using parent rotation
            const parentRotMat = getParentRotMatrix(groups[groupId]?.parentId, groups);
            const worldDelta = new THREE.Vector3(0, 0, 0);
            worldDelta.setComponent(index, localDelta);
            worldDelta.applyMatrix4(parentRotMat);

            // Recursively collect all board IDs inside this group
            const insideBoardIds = new Set();
            const collectChildren = (parentId) => {
                boards.forEach(b => { if (b.parentId === parentId) insideBoardIds.add(b.id.toString()); });
                Object.keys(groups).forEach(k => { if (groups[k].parentId === parentId) collectChildren(k); });
            };
            collectChildren(groupId);

            if (insideBoardIds.size === 0) return;

            // Flood-fill outward through enabled constraints to find linked external boards
            let externalLinkedIds = new Set();
            let frontier = new Set(insideBoardIds);
            let visited = new Set(insideBoardIds);
            let changed = true;
            while (changed) {
                changed = false;
                boards.forEach(b => {
                    const bid = b.id.toString();
                    if (visited.has(bid)) return;
                    // Check if this board has an enabled constraint pointing to something in our set
                    if (b.constraints && b.constraints.some(c => c.enabled !== false && visited.has(c.targetId.toString()))) {
                        visited.add(bid);
                        externalLinkedIds.add(bid);
                        changed = true;
                    }
                });
                // Also check if any board in our set has an enabled constraint pointing outward
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

            // Remove inside boards — we only want to move the external ones
            insideBoardIds.forEach(id => externalLinkedIds.delete(id));

            if (externalLinkedIds.size === 0) return;

            // Apply world delta to each external linked board, converted to its local space
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
    };

    const processAiCommand = (text) => {
        pushHistory();
        const lower = text.toLowerCase();
        let reply = "I've processed your spatial request.";
        let updated = false;
        let floorDropPayload = null;

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

            let movingIds = new Set(selectedItemIds);
            let added = true;
            while (added) {
                added = false;
                boards.forEach(b => {
                    if (b.constraints && b.constraints.some(c => c.enabled !== false && movingIds.has(c.targetId.toString()))) {
                        if (!movingIds.has(b.id.toString())) { movingIds.add(b.id.toString()); added = true; }
                    }
                    if (movingIds.has(b.id.toString()) && b.constraints) {
                        b.constraints.forEach(c => {
                            if (c.enabled !== false && !movingIds.has(c.targetId.toString())) { movingIds.add(c.targetId.toString()); added = true; }
                        });
                    }
                });
            }

            // Automatically move groups if they are selected natively
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
        } else if (/(cut|add|trim|extend|shave|chop|short|long|wide|narrow|thick|thin|reduce|increase|shrink|grow|length|width|thickness|decrease)/.test(lower)) {
            const match = lower.match(/(\d*\.?\d+)/);
            if (match) {
                const val = parseFloat(match[1]);
                const isNegative = /(cut|trim|shave|chop|short|narrow|thin|reduce|shrink|decrease)/.test(lower);
                const delta = isNegative ? -val : val;

                const isLength = /(short|long|length|tall|top|bottom)/.test(lower);
                const isWidth = /(wide|narrow|width|left|right)/.test(lower);

                let targetedBoards = selectedItemIds.length > 0 ? boards.filter(b => selectedItemIds.includes(b.id.toString())) : [];

                // Fallback: If nothing is selected, try to infer the target board by name matching the chat text
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
                                targetIndex = dims[0].idx; // Default to longest dimension
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
            let axis = 1; // Default to Y (Green)
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

                // Only block rotation if the component is actively constrained
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
                const getGlobalMatrix = (id, isBoard) => {
                    let mat = new THREE.Matrix4();
                    let cur = id; let isB = isBoard;
                    while (cur) {
                        let p = [0, 0, 0], r = [0, 0, 0], parentId = null;
                        if (isB) {
                            const b = boards.find(x => x.id.toString() === cur);
                            if (b) { p = b.position || [0, 0, 0]; r = b.rotation || [0, 0, 0]; parentId = b.parentId; }
                            isB = false;
                        } else {
                            const g = groups[cur];
                            if (g) { p = g.position || [0, 0, 0]; r = g.rotation || [0, 0, 0]; parentId = g.parentId; }
                        }
                        mat.premultiply(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r, 'XYZ')), new THREE.Vector3(1, 1, 1)));
                        cur = parentId;
                    }
                    return mat;
                };

                let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxY = -Infinity, minY = Infinity;

                targets.forEach(b => {
                    const w = b.size[0] / 2, h = b.size[1] / 2, d = b.size[2] / 2;
                    const corners = [
                        new THREE.Vector3(w, h, d), new THREE.Vector3(w, h, -d), new THREE.Vector3(w, -h, d), new THREE.Vector3(w, -h, -d),
                        new THREE.Vector3(-w, h, d), new THREE.Vector3(-w, h, -d), new THREE.Vector3(-w, -h, d), new THREE.Vector3(-w, -h, -d)
                    ];

                    const mat = getGlobalMatrix(b.id.toString(), true);

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

                // Calculate the absolute internal architectural span
                const geometricBase = minY !== Infinity ? minY : 0;
                const projectedAssemblyHeight = (maxY + thickness) - geometricBase;

                // If global bounding constraints are active, evaluate physical volumetric breach
                if (globalBounds.enabled && projectedAssemblyHeight > globalBounds.y) {
                    trimNotice = `\n\nWARNING: The generated Top extends to ${projectedAssemblyHeight.toFixed(2)}", which exceeds your workspace height limit of ${globalBounds.y}". You may want to manually move it or resize the legs.`;
                }

                const newId = Date.now();
                const pId = targets[0]?.parentId || 'Workspace';

                const pMatrix = getGlobalMatrix(pId, false);
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
        }

        if (!updated) {
            reply = "I need clearer spatial constraints. Try 'move selected down 1 inch' or 'change to cherry'.";
        }

        setTimeout(() => {
            setChatMessages(prev => [...prev, { role: 'ai', text: reply }]);
        }, 500);
    };

    const submitChat = () => {
        if (chatInput.trim()) {
            setChatMessages(prev => [...prev, { role: 'user', text: chatInput }]);
            processAiCommand(chatInput);
            setChatInput('');
        }
    };

    const handleDragStart = (e, id, type) => {
        e.dataTransfer.setData('drag_id', id);
        e.dataTransfer.setData('drag_type', type);
        e.stopPropagation();
    };

    const handleDrop = (e, newParentId) => {
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
    };

    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };

    const renderTree = (nodeId, depth = 0, isParentSelected = false) => {
        const isGroup = groups[nodeId] !== undefined;
        const g = isGroup ? groups[nodeId] : boards.find(b => b.id.toString() === nodeId);
        if (!g) return null;

        const isSelected = selectedItemIds.includes(nodeId.toString()) || isParentSelected;

        const childGroups = Object.keys(groups).filter(k => groups[k].parentId === nodeId);
        const childBoards = boards.filter(b => b.parentId === nodeId);
        const hasChildren = childGroups.length > 0 || childBoards.length > 0;

        return (
            <div key={nodeId} style={{ marginLeft: depth > 0 ? 12 : 0 }}>
                <div
                    className={`tree-item ${isGroup ? 'active' : 'child'} ${isSelected ? 'highlighted' : ''}`}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    draggable={depth > 0}
                    onDragStart={e => handleDragStart(e, nodeId.toString(), isGroup ? 'group' : 'board')}
                    onDragOver={handleDragOver}
                    onDrop={e => { if (isGroup) handleDrop(e, nodeId); }}
                    onClick={(e) => toggleSelection(nodeId.toString(), e.shiftKey || e.ctrlKey || e.metaKey)}
                >
                    <span style={{ flex: 1, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {isGroup && hasChildren && (
                            <span
                                onClick={(e) => { e.stopPropagation(); setGroups(p => ({ ...p, [nodeId]: { ...p[nodeId], isExpanded: !p[nodeId].isExpanded } })); }}
                                style={{ marginRight: '4px', display: 'inline-block', width: '12px' }}
                            >
                                {g.isExpanded ? '⏷' : '⏵'}
                            </span>
                        )}
                        {isGroup && !hasChildren && <span style={{ marginRight: '4px', display: 'inline-block', width: '12px' }}></span>}
                        {isGroup ? nodeId : g.name}
                    </span>
                    <button
                        onClick={(e) => { e.stopPropagation(); isGroup ? toggleGroupVisibility(nodeId) : toggleBoardVisibility(parseInt(nodeId)); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: g.visible !== false ? 1 : 0.3, color: 'var(--text-main)', display: 'flex', alignItems: 'center' }}
                        title="Toggle Visibility"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                </div>

                {isGroup && g.isExpanded && (
                    <div>
                        {childGroups.map(k => renderTree(k, depth + 1, isSelected))}
                        {childBoards.map(b => renderTree(b.id.toString(), depth + 1, isSelected))}
                    </div>
                )}
            </div>
        );
    };

    const selectedBoard = selectedItemIds.length === 1 && boards.find(b => b.id.toString() === selectedItemIds[0]);
    const selectedGroup = selectedItemIds.length === 1 && Object.keys(groups).find(k => k === selectedItemIds[0]);


    // Rough AABB Calculation for Inspector
    let overallSize = [0, 0, 0];
    let calculatedMinY = 0;
    if (selectedGroup) {
        const childBoards = [];
        const traverse = (parentId) => {
            boards.filter(b => b.parentId === parentId).forEach(b => childBoards.push(b));
            Object.keys(groups).filter(k => groups[k].parentId === parentId).forEach(k => traverse(k));
        };
        traverse(selectedGroup);

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
        childBoards.forEach(b => {
            let dx = b.size[0] / 2, dy = b.size[1] / 2, dz = b.size[2] / 2;
            if (Math.abs(Math.sin(b.rotation?.[0] || 0)) > 0.5) { let tmp = dy; dy = dz; dz = tmp; }
            if (Math.abs(Math.sin(b.rotation?.[1] || 0)) > 0.5) { let tmp = dx; dx = dz; dz = tmp; }
            if (Math.abs(Math.sin(b.rotation?.[2] || 0)) > 0.5) { let tmp = dx; dx = dy; dy = tmp; }
            minX = Math.min(minX, b.position[0] - dx); maxX = Math.max(maxX, b.position[0] + dx);
            minY = Math.min(minY, b.position[1] - dy); maxY = Math.max(maxY, b.position[1] + dy);
            minZ = Math.min(minZ, b.position[2] - dz); maxZ = Math.max(maxZ, b.position[2] + dz);
        });
        if (childBoards.length > 0) {
            overallSize = [Math.abs(maxX - minX), Math.abs(maxY - minY), Math.abs(maxZ - minZ)];
            calculatedMinY = minY;
        }
    }

    const dropGroupToFloor = () => {
        if (!selectedGroup) return;
        pushHistory();
        let lowestY = Infinity;
        const getMatrix = (id, isBoard = false) => {
            let mat = new THREE.Matrix4();
            let cur = id; let isB = isBoard;
            while (cur) {
                let p = [0, 0, 0], r = [0, 0, 0], pId = null;
                if (isB) {
                    const b = boards.find(x => x.id.toString() === cur);
                    if (b) { p = b.position || [0, 0, 0]; r = b.rotation || [0, 0, 0]; pId = b.parentId; }
                    isB = false;
                } else {
                    const g = groups[cur];
                    if (g) { p = g.position || [0, 0, 0]; r = g.rotation || [0, 0, 0]; pId = g.parentId; }
                }
                const lMat = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r, 'XYZ')), new THREE.Vector3(1, 1, 1));
                mat.premultiply(lMat);
                cur = pId;
            }
            return mat;
        };
        const getParentRotMatrix = (pId) => {
            let mat = new THREE.Matrix4();
            let cur = pId;
            while (cur) {
                const g = groups[cur];
                if (g) {
                    mat.premultiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...(g.rotation || [0, 0, 0]), 'XYZ')));
                    cur = g.parentId;
                } else cur = null;
            }
            return mat;
        };

        const cb = [];
        const traverse = (pId) => {
            boards.filter(b => b.parentId === pId).forEach(b => cb.push(b));
            Object.keys(groups).filter(k => groups[k].parentId === pId).forEach(k => traverse(k));
        };
        traverse(selectedGroup);

        cb.forEach(b => {
            const mat = getMatrix(b.id.toString(), true);
            const w = b.size[0] / 2, h = b.size[1] / 2, d = b.size[2] / 2;
            const corners = [
                new THREE.Vector3(w, h, d), new THREE.Vector3(w, h, -d), new THREE.Vector3(w, -h, d), new THREE.Vector3(w, -h, -d),
                new THREE.Vector3(-w, h, d), new THREE.Vector3(-w, h, -d), new THREE.Vector3(-w, -h, d), new THREE.Vector3(-w, -h, -d)
            ];
            corners.forEach(v => { v.applyMatrix4(mat); if (v.y < lowestY) lowestY = v.y; });
        });

        if (lowestY === Infinity) return;
        const offset = new THREE.Vector3(0, -3 - lowestY, 0).applyMatrix4(getParentRotMatrix(groups[selectedGroup].parentId).invert());

        setGroups(prev => {
            const cur = prev[selectedGroup];
            let p = cur.position || [0, 0, 0];
            return { ...prev, [selectedGroup]: { ...cur, position: [p[0] + offset.x, p[1] + offset.y, p[2] + offset.z] } };
        });
    };

    const dropBoardToFloor = () => {
        if (!selectedBoard) return;
        pushHistory();

        const getMatrix = (id, isBoard = false) => {
            let mat = new THREE.Matrix4();
            let cur = id; let isB = isBoard;
            while (cur) {
                let p = [0, 0, 0], r = [0, 0, 0], pId = null;
                if (isB) {
                    const b = boards.find(x => x.id.toString() === cur);
                    if (b) { p = b.position || [0, 0, 0]; r = b.rotation || [0, 0, 0]; pId = b.parentId; }
                    isB = false;
                } else {
                    const g = groups[cur];
                    if (g) { p = g.position || [0, 0, 0]; r = g.rotation || [0, 0, 0]; pId = g.parentId; }
                }
                mat.premultiply(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r, 'XYZ')), new THREE.Vector3(1, 1, 1)));
                cur = pId;
            }
            return mat;
        };
        const getParentRotMat = (pId) => {
            let mat = new THREE.Matrix4();
            let cur = pId;
            while (cur) {
                const g = groups[cur];
                if (g) {
                    mat.premultiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...(g.rotation || [0, 0, 0]), 'XYZ')));
                    cur = g.parentId;
                } else cur = null;
            }
            return mat;
        };

        let lowestY = Infinity;
        const mat = getMatrix(selectedBoard.id.toString(), true);
        const w = selectedBoard.size[0] / 2, h = selectedBoard.size[1] / 2, d = selectedBoard.size[2] / 2;
        const corners = [
            new THREE.Vector3(w, h, d), new THREE.Vector3(w, h, -d), new THREE.Vector3(w, -h, d), new THREE.Vector3(w, -h, -d),
            new THREE.Vector3(-w, h, d), new THREE.Vector3(-w, h, -d), new THREE.Vector3(-w, -h, d), new THREE.Vector3(-w, -h, -d)
        ];
        corners.forEach(v => { v.applyMatrix4(mat); if (v.y < lowestY) lowestY = v.y; });

        if (lowestY === Infinity) return;
        const offset = new THREE.Vector3(0, -3 - lowestY, 0).applyMatrix4(getParentRotMat(selectedBoard.parentId).invert());

        setBoards(boards.map(b => {
            if (selectedItemIds.includes(b.id.toString())) {
                let p = b.position || [0, 0, 0];
                return { ...b, position: [p[0] + offset.x, p[1] + offset.y, p[2] + offset.z] };
            }
            return b;
        }));
    };

    useEffect(() => {
        if (theme === 'light') document.documentElement.classList.add('light-mode');
        else document.documentElement.classList.remove('light-mode');
    }, [theme]);

    const rootNodes = Object.keys(groups).filter(k => groups[k].parentId === null);

    const manualAddBoard = () => {
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
    };

    const handleAssemblyDelete = () => {
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
    };

    const handleComponentDelete = () => {
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
    };

    const manualAddAssembly = () => {
        pushHistory();
        const newId = 'Assembly ' + Math.floor(Math.random() * 1000);
        const targetParent = selectedGroup || (selectedBoard ? selectedBoard.parentId : 'Workspace');
        setGroups(prev => ({
            ...prev,
            [newId]: { parentId: targetParent, isExpanded: true, visible: true, position: [0, 0, 0], rotation: [0, 0, 0] }
        }));
        setSelectedItemIds([newId]);
    };

    return (
        <div className="app-container">
            {toast && (
                <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: 'var(--accent-color)', color: '#fff', padding: '12px 24px', borderRadius: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 10000, fontWeight: 'bold' }}>
                    {toast}
                </div>
            )}
            <div className="canvas-area">
                <Viewport3D
                    boards={boards}
                    groups={groups}
                    globalBounds={globalBounds}
                    selectedItemIds={selectedItemIds}
                    setSelectedItemIds={setSelectedItemIds}
                    toggleSelection={toggleSelection}
                    gridSnap={gridSnap}
                    theme={theme}
                    showEdges={showEdges}
                    showDimensions={showDimensions}
                    showBoundingBox={showBoundingBox}
                    units={units}
                    constraintTargetMode={constraintTargetMode}
                />
            </div>

            <div className="app-overlay">
                <header className="app-header glass-panel">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                        <div className="logo">Little Lucey <span>Woodcraft</span></div>
                        <div className="toolbar-menus">
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                                <span onClick={() => setFileMenuOpen(!fileMenuOpen)} style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', background: fileMenuOpen ? 'var(--bg-color)' : 'transparent' }}>
                                    File ⏷
                                </span>
                                {fileMenuOpen && (
                                    <div className="glass-panel" style={{
                                        position: 'absolute', top: '100%', left: 0, marginTop: '8px',
                                        display: 'flex', flexDirection: 'column', padding: '8px', minWidth: '160px',
                                        zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', border: '1px solid var(--border-color)',
                                        borderRadius: '8px', background: 'var(--panel-bg)'
                                    }}>
                                        <button className="nav-btn" style={{ textAlign: 'left', border: 'none', padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => { saveWorkspace(); setFileMenuOpen(false); }}>💾 Save</button>
                                        <button className="nav-btn" style={{ textAlign: 'left', border: 'none', padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => { exportWorkspace(); setFileMenuOpen(false); }}>💾 Save As...</button>
                                        <div className="divider" style={{ width: '100%', height: '1px', margin: '4px 0' }}></div>
                                        <button className="nav-btn" style={{ textAlign: 'left', border: 'none', padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => { loadWorkspace(); setFileMenuOpen(false); }}>📂 Load</button>
                                        <button className="nav-btn" style={{ textAlign: 'left', border: 'none', padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => { document.getElementById('project-import-input').click(); setFileMenuOpen(false); }}>📂 Open...</button>

                                        {recentFiles.length > 0 && (
                                            <>
                                                <div className="divider" style={{ width: '100%', height: '1px', margin: '4px 0' }}></div>
                                                <div style={{ padding: '4px 12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Open Recent</div>
                                                {recentFiles.map(r => (
                                                    <button key={r.name} className="nav-btn" style={{ textAlign: 'left', border: 'none', padding: '6px 12px', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} onClick={() => { loadWorkspace(r.name); setFileMenuOpen(false); }}>
                                                        ⏱ {r.name}
                                                    </button>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                            <input type="file" id="project-import-input" accept=".json" style={{ display: 'none' }} onChange={importWorkspace} />
                            <span onClick={handleUndo} style={{ opacity: history.length ? 1 : 0.4, marginLeft: '16px', cursor: history.length ? 'pointer' : 'default' }}>Undo ({history.length})</span>
                            <span onClick={handleRedo} style={{ opacity: redoHistory.length ? 1 : 0.4, marginLeft: '16px', cursor: redoHistory.length ? 'pointer' : 'default' }}>Redo ({redoHistory.length})</span>
                        </div>
                    </div>
                    <nav className="top-nav">
                        <button className={`nav-btn ${showCutlistPanel ? 'active' : ''}`} onClick={() => setShowCutlistPanel(!showCutlistPanel)}>Cut List</button>
                        <button className={`nav-btn ${showSettingsPanel ? 'active' : ''}`} onClick={() => setShowSettingsPanel(!showSettingsPanel)}>Settings</button>
                        <div className="divider"></div>
                        <button className={`nav-btn ${showDimensions ? 'active' : ''}`} onClick={() => setShowDimensions(!showDimensions)}>
                            {showDimensions ? 'Dims: ON' : 'Dims: OFF'}
                        </button>
                        <div className="divider"></div>
                        <button className="nav-btn accent-fill" onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}>
                            {isRightPanelOpen ? 'Hide Panel ⏵' : '⏴ Show Panel'}
                        </button>
                    </nav>
                </header>

                <main className="main-workspace">
                    {isRightPanelOpen && (
                        <DraggablePanel title="AI Assistant" defaultPosition={{ x: 20, y: window.innerHeight * 0.45 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <div className="chat-window" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                                    {chatMessages.map((m, i) => (
                                        <div key={i} className={`chat-message ${m.role}`} style={{
                                            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                                            background: m.role === 'user' ? 'var(--bg-color)' : 'rgba(188, 138, 95, 0.1)',
                                            borderLeft: m.role === 'user' ? 'none' : '3px solid var(--accent-color)',
                                            borderRight: m.role === 'user' ? '3px solid var(--text-muted)' : 'none',
                                            maxWidth: '85%',
                                            padding: '6px 10px',
                                            fontSize: '0.75rem'
                                        }}>
                                            {m.text}
                                        </div>
                                    ))}
                                </div>
                                <div className="chat-input-wrapper">
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={e => setChatInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && submitChat()}
                                        placeholder="e.g. Move the top up 1 inch"
                                        style={{ fontSize: '0.75rem', padding: '8px 10px' }}
                                    />
                                </div>
                            </div>
                        </DraggablePanel>
                    )}

                    <aside className={`sidebar right-sidebar ${!isRightPanelOpen ? 'collapsed' : ''}`} style={{ background: 'transparent' }}>
                        <div className="flex-1 inspector-panel" style={{ overflowY: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }} onFocusCapture={(e) => { if (e.target.tagName === 'INPUT') pushHistory(); }}>
                            {showSettingsPanel && (
                                <DraggablePanel title="Settings" defaultPosition={{ x: window.innerWidth / 2 - 250, y: 100 }} defaultSize={{ width: 500 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px', color: 'var(--text-main)' }}>

                                        <div>
                                            <label style={{ fontWeight: '600', opacity: 0.85, display: 'block', marginBottom: '8px' }}>Measurement System</label>
                                            <select className="nav-btn" value={units} onChange={(e) => setUnits(e.target.value)} style={{ width: '100%', outline: 'none' }}>
                                                <option value="imperial">Imperial (Inches / Fractions)</option>
                                                <option value="metric">Metric (Millimeters)</option>
                                            </select>
                                            <p className="hint" style={{ marginTop: '4px' }}>Viewport vectors will automatically convert to your selected unit standard.</p>
                                        </div>

                                        <div>
                                            <label style={{ fontWeight: '600', opacity: 0.85, display: 'block', marginBottom: '8px' }}>Global Grid Snapping</label>
                                            <select className="nav-btn" value={gridSnap} onChange={(e) => setGridSnap(e.target.value)} style={{ width: '100%', outline: 'none' }}>
                                                <option value="off">Off (Free floating)</option>
                                                <option value="1/8 in">1/8 Inch (Precision)</option>
                                                <option value="1/2 in">1/2 Inch (Standard)</option>
                                                <option value="1 in">1 Inch (Rough)</option>
                                            </select>
                                            <p className="hint" style={{ marginTop: '4px' }}>Controls the bounding lock when nudging components via the AI or inspector.</p>
                                        </div>

                                        <div>
                                            <label style={{ fontWeight: '600', opacity: 0.85, display: 'block', marginBottom: '8px' }}>Default Board Material</label>
                                            <select className="nav-btn" value={defaultMaterial} onChange={(e) => setDefaultMaterial(e.target.value)} style={{ width: '100%', outline: 'none', textTransform: 'capitalize' }}>
                                                {['pine', 'cherry', 'walnut', 'red-oak', 'white-oak'].map(m => <option key={m} value={m}>{m.replace('-', ' ')}</option>)}
                                            </select>
                                            <p className="hint" style={{ marginTop: '4px' }}>Default lumber allocated when generating new boards or assemblies.</p>
                                        </div>

                                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600', opacity: 0.85 }}>
                                                <input type="checkbox" checked={showEdges} onChange={(e) => setShowEdges(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                                                Show Architectural Edges
                                            </label>
                                            <p className="hint" style={{ marginTop: '4px' }}>Renders high-contrast boundary lines around all structural components.</p>
                                        </div>

                                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600', opacity: 0.85 }}>
                                                <input type="checkbox" checked={showDimensions} onChange={(e) => setShowDimensions(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                                                Show Dimensions
                                            </label>
                                            <p className="hint" style={{ marginTop: '4px' }}>Renders 3D bounding dimension lines and text in the viewport.</p>
                                        </div>

                                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600', opacity: 0.85 }}>
                                                <input type="checkbox" checked={showBoundingBox} onChange={(e) => setShowBoundingBox(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                                                Show Selection Envelope
                                            </label>
                                            <p className="hint" style={{ marginTop: '4px' }}>Renders an absolute 3D bounding box indicating total geometric size of selected components.</p>
                                        </div>

                                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <label style={{ fontWeight: '600', opacity: 0.85, margin: 0 }}>Project Volume Bounds</label>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'normal', fontSize: '0.8rem', color: 'var(--accent-color)' }}>
                                                    <input type="checkbox" checked={globalBounds.enabled} onChange={(e) => setGlobalBounds(prev => ({ ...prev, enabled: e.target.checked }))} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                                                </label>
                                            </div>
                                            <p className="hint" style={{ marginTop: '8px' }}>Forces Top generation AI to strictly adhere to maximum limit dimensions, automatically shrinking structural elements down to specified hardware tolerances!</p>
                                            {globalBounds.enabled && (
                                                <div className="vec3-inputs" style={{ marginTop: '12px' }}>
                                                    <div>W<input type="number" step="1" value={globalBounds.x} onChange={e => setGlobalBounds(prev => ({ ...prev, x: parseFloat(e.target.value) || 0 }))} title="Max Width" /></div>
                                                    <div style={{ borderColor: 'var(--accent-color)' }}>H<input type="number" step="1" value={globalBounds.y} onChange={e => setGlobalBounds(prev => ({ ...prev, y: parseFloat(e.target.value) || 0 }))} title="Max Height" /></div>
                                                    <div>D<input type="number" step="1" value={globalBounds.z} onChange={e => setGlobalBounds(prev => ({ ...prev, z: parseFloat(e.target.value) || 0 }))} title="Max Depth" /></div>
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                                                <input type="checkbox" checked={theme === 'dark'} onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')} style={{ width: '18px', height: '18px' }} />
                                                Enable Dark Mode
                                            </label>
                                            <p className="hint" style={{ marginTop: '4px' }}>Toggle between high-contrast layout and daylight drafting theme.</p>
                                        </div>

                                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                                            <strong style={{ color: '#ff3b30' }}>System Storage Cache</strong>
                                            <p className="hint" style={{ marginTop: '4px', marginBottom: '8px' }}>Permanently destroy the browser's local memory reserve.</p>
                                            <button className="nav-btn" style={{ color: '#ff3b30', borderColor: 'rgba(255, 59, 48, 0.3)' }} onClick={() => { if (confirm('Destroy local workspace cache?')) { localStorage.removeItem('lucey_save'); alert('Cache destroyed. Please reload.'); } }}>Wipe Local Cache</button>
                                        </div>

                                    </div>
                                </DraggablePanel>
                            )}

                            <DraggablePanel title="Outliner" defaultPosition={{ x: window.innerWidth - 270, y: 80 }}>
                                <div className="tree-view" style={{ flex: 1, overflowY: 'auto', paddingBottom: '8px' }}>
                                    <div className="tree-view" style={{ paddingBottom: '24px' }}>
                                        {rootNodes.map(k => renderTree(k))}

                                        <div style={{ marginTop: '24px', display: 'flex', gap: '8px', padding: '0 8px' }}>
                                            <button className="nav-btn" style={{ flex: 1, border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.05)' }} onClick={manualAddBoard}>+ New Board</button>
                                            <button className="nav-btn" style={{ flex: 1, border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.05)' }} onClick={manualAddAssembly}>+ Assembly</button>
                                        </div>
                                        <p className="hint" style={{ textAlign: 'center', marginTop: '8px' }}>Generates pieces inside your selected group.</p>
                                    </div>
                                </div>
                            </DraggablePanel>

                            <DraggablePanel title="Inspector" defaultPosition={{ x: window.innerWidth - 540, y: 80 }} onFocusCapture={(e) => { if (e.target.tagName === 'INPUT') pushHistory(); }}>
                                {selectedGroup ? (
                                    (() => {
                                        const isWorkspace = selectedGroup === 'Workspace';
                                        let moveColors = ['transparent', 'transparent', 'transparent'];
                                        if (!isWorkspace) {
                                            const pMat = getParentRotMatrix(groups[selectedGroup].parentId, groups);
                                            const pE = pMat.elements;
                                            const getColor = (v) => {
                                                let ax = Math.abs(v.x), ay = Math.abs(v.y), az = Math.abs(v.z);
                                                if (ax > ay && ax > az) return 'rgba(255, 60, 60, 0.2)';
                                                if (ay > ax && ay > az) return 'rgba(60, 255, 60, 0.2)';
                                                return 'rgba(60, 150, 255, 0.2)';
                                            };
                                            moveColors = [
                                                getColor(new THREE.Vector3(pE[0], pE[1], pE[2]).normalize()),
                                                getColor(new THREE.Vector3(pE[4], pE[5], pE[6]).normalize()),
                                                getColor(new THREE.Vector3(pE[8], pE[9], pE[10]).normalize())
                                            ];
                                        }

                                        return (
                                            <>
                                                <div className="inspector-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Assembly:</span>
                                                    <input 
                                                        type="text" 
                                                        value={selectedGroup} 
                                                        disabled={isWorkspace}
                                                        title={isWorkspace ? 'Root workspace cannot be renamed' : 'Click to rename assembly'}
                                                        onChange={(e) => {
                                                            const newName = e.target.value;
                                                            if (newName === selectedGroup || groups[newName]) return;
                                                            let nextGroups = { ...groups };
                                                            nextGroups[newName] = nextGroups[selectedGroup];
                                                            delete nextGroups[selectedGroup];
                                                            Object.keys(nextGroups).forEach(k => {
                                                                if (nextGroups[k].parentId === selectedGroup) nextGroups[k].parentId = newName;
                                                            });
                                                            setGroups(nextGroups);
                                                            setBoards(boards.map(bd => bd.parentId === selectedGroup ? { ...bd, parentId: newName } : bd));
                                                            setSelectedItemIds(selectedItemIds.map(id => id === selectedGroup ? newName : id));
                                                        }}
                                                        style={{ flex: 1, width: '100%', background: isWorkspace ? 'transparent' : 'rgba(128,128,128,0.15)', padding: '6px 12px', borderRadius: '6px', border: '1px solid', borderColor: isWorkspace ? 'transparent' : 'var(--border-color)', color: 'var(--accent-color)', fontSize: 'inherit', fontWeight: 'inherit', outline: 'none' }} 
                                                    />
                                                </div>
                                        <div className="inspector-section">
                                            <h4>Overall Dimensions (in)</h4>
                                            <div className="vec3-inputs">
                                                <div>X<input type="number" value={overallSize[0].toFixed(4)} disabled /></div>
                                                <div>Y<input type="number" value={overallSize[1].toFixed(4)} disabled /></div>
                                                <div>Z<input type="number" value={overallSize[2].toFixed(4)} disabled /></div>
                                            </div>
                                        </div>
                                        <div className="inspector-section">
                                            <h4>Group Position (in)</h4>
                                            <div className="vec3-inputs">
                                                <div style={{ backgroundColor: moveColors[0] }}>X<input type="number" value={Number((groups[selectedGroup].position || [0, 0, 0])[0].toFixed(4))} onChange={e => updateGroupVector(selectedGroup, 'position', 0, e.target.value)} /></div>
                                                <div style={{ backgroundColor: moveColors[1] }}>Y<input type="number" value={Number((groups[selectedGroup].position || [0, 0, 0])[1].toFixed(4))} onChange={e => updateGroupVector(selectedGroup, 'position', 1, e.target.value)} /></div>
                                                <div style={{ backgroundColor: moveColors[2] }}>Z<input type="number" value={Number((groups[selectedGroup].position || [0, 0, 0])[2].toFixed(4))} onChange={e => updateGroupVector(selectedGroup, 'position', 2, e.target.value)} /></div>
                                            </div>
                                            <button style={{ marginTop: '8px', width: '100%' }} className="primary-btn" onClick={dropGroupToFloor}>↓ Set on Floor</button>
                                        </div>
                                        <div className="inspector-section">
                                            <h4>Group Angle (deg)</h4>
                                            <div className="vec3-inputs">
                                                <div>X<input type="number" step="5" value={Math.round((groups[selectedGroup].rotation || [0, 0, 0])[0] * 180 / Math.PI)} onChange={e => updateGroupVector(selectedGroup, 'rotation', 0, e.target.value)} /></div>
                                                <div>Y<input type="number" step="5" value={Math.round((groups[selectedGroup].rotation || [0, 0, 0])[1] * 180 / Math.PI)} onChange={e => updateGroupVector(selectedGroup, 'rotation', 1, e.target.value)} /></div>
                                                <div>Z<input type="number" step="5" value={Math.round((groups[selectedGroup].rotation || [0, 0, 0])[2] * 180 / Math.PI)} onChange={e => updateGroupVector(selectedGroup, 'rotation', 2, e.target.value)} /></div>
                                            </div>
                                            <p className="hint" style={{ marginTop: '8px' }}>Transforms apply recursively down the tree stack.</p>
                                        </div>
                                        {!isWorkspace && (
                                            <div style={{ marginTop: '16px' }}>
                                                <button
                                                    className="nav-btn"
                                                    style={{ width: '100%', padding: '8px', color: '#ff3b30', border: '1px solid rgba(255, 59, 48, 0.3)', background: 'rgba(255, 59, 48, 0.05)', fontWeight: 'bold', transition: 'background 0.2s' }}
                                                    onMouseEnter={e => e.target.style.background = 'rgba(255, 59, 48, 0.15)'}
                                                    onMouseLeave={e => e.target.style.background = 'rgba(255, 59, 48, 0.05)'}
                                                    onClick={handleAssemblyDelete}
                                                >
                                                    Delete Assembly & Contents
                                                </button>
                                            </div>
                                        )}
                                    </>
                                );
                            })()
                                ) : selectedItemIds.length > 1 ? (
                                    <>
                                        <div className="inspector-title">Multiple Selected ({selectedItemIds.length})</div>
                                        <div className="inspector-section"><p className="hint">Use AI Chat for bulk transforms.</p></div>
                                    </>
                                ) : selectedBoard ? (
                                    (() => {
                                        const pMat = getParentRotMatrix(selectedBoard.parentId, groups);
                                        const pE = pMat.elements;
                                        const pX = new THREE.Vector3(pE[0], pE[1], pE[2]).normalize();
                                        const pY = new THREE.Vector3(pE[4], pE[5], pE[6]).normalize();
                                        const pZ = new THREE.Vector3(pE[8], pE[9], pE[10]).normalize();

                                        const getColor = (v) => {
                                            let ax = Math.abs(v.x), ay = Math.abs(v.y), az = Math.abs(v.z);
                                            if (ax > ay && ax > az) return 'rgba(255, 60, 60, 0.2)';
                                            if (ay > ax && ay > az) return 'rgba(60, 255, 60, 0.2)';
                                            return 'rgba(60, 150, 255, 0.2)';
                                        };
                                        const moveColors = [getColor(pX), getColor(pY), getColor(pZ)];

                                        const incomingConstraints = [];
                                        boards.forEach(b => {
                                            if (b.id !== selectedBoard.id && b.constraints) {
                                                b.constraints.forEach((c, idx) => {
                                                    if (c.targetId.toString() === selectedBoard.id.toString()) {
                                                        incomingConstraints.push({ sourceBoard: b, constraint: c, internalIndex: idx });
                                                    }
                                                });
                                            }
                                        });

                                        const hasActiveGlue = (selectedBoard.constraints || []).some(c => c.type === 'Glue' && c.enabled !== false) ||
                                            incomingConstraints.some(c => c.constraint.type === 'Glue' && c.constraint.enabled !== false);

                                        return (
                                            <>
                                                <div className="inspector-title" style={{ marginBottom: '16px' }}>
                                                    <input type="text" value={selectedBoard.name} onChange={e => { const v = e.target.value; setBoards(prev => prev.map(b => b.id === selectedBoard.id ? { ...b, name: v } : b)); }} title="Click to rename component" style={{ width: '100%', background: 'rgba(128,128,128,0.15)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', color: 'var(--accent-color)', fontSize: 'inherit', fontWeight: 'inherit', outline: 'none' }} />
                                                </div>
                                                <div className="inspector-section">
                                                    <h4>Dimensions (in)</h4>
                                                    <div className="vec3-inputs">
                                                        <div>L<input type="number" step="0.5" value={Number(selectedBoard.size[1].toFixed(4))} onChange={e => updateVector('size', 1, e.target.value)} /></div>
                                                        <div>W<input type="number" step="0.5" value={Number(selectedBoard.size[0].toFixed(4))} onChange={e => updateVector('size', 0, e.target.value)} /></div>
                                                        <div>D<input type="number" step="0.5" value={Number(selectedBoard.size[2].toFixed(4))} onChange={e => updateVector('size', 2, e.target.value)} /></div>
                                                    </div>
                                                </div>
                                                <div className="inspector-section">
                                                    <h4>Move / Offset (in)</h4>
                                                    <div className="vec3-inputs">
                                                        <div style={{ backgroundColor: moveColors[0] }}>X<input type="number" step="0.125" value={Number(selectedBoard.position[0].toFixed(4))} onChange={e => updateVector('position', 0, e.target.value)} /></div>
                                                        <div style={{ backgroundColor: moveColors[1] }}>Y<input type="number" step="0.125" value={Number(selectedBoard.position[1].toFixed(4))} onChange={e => updateVector('position', 1, e.target.value)} /></div>
                                                        <div style={{ backgroundColor: moveColors[2] }}>Z<input type="number" step="0.125" value={Number(selectedBoard.position[2].toFixed(4))} onChange={e => updateVector('position', 2, e.target.value)} /></div>
                                                    </div>
                                                    <button style={{ marginTop: '8px', width: '100%' }} className="primary-btn" onClick={dropBoardToFloor}>↓ Set on Floor</button>
                                                </div>
                                                <div className="inspector-section">
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <h4>Angle Setting (deg)</h4>
                                                        {hasActiveGlue && <span style={{ fontSize: '0.6rem', color: '#ff3b30', textTransform: 'uppercase', fontWeight: 'bold' }}>Locked by Glue</span>}
                                                    </div>
                                                    <div className="vec3-inputs" style={{ opacity: hasActiveGlue ? 0.5 : 1 }}>
                                                        <div>X<input type="number" step="5" value={Math.round((selectedBoard.rotation || [0, 0, 0])[0] * 180 / Math.PI)} onChange={e => updateVector('rotation', 0, e.target.value * Math.PI / 180)} disabled={hasActiveGlue} title={hasActiveGlue ? 'Rotation locked by active Glue constraint' : ''} /></div>
                                                        <div>Y<input type="number" step="5" value={Math.round((selectedBoard.rotation || [0, 0, 0])[1] * 180 / Math.PI)} onChange={e => updateVector('rotation', 1, e.target.value * Math.PI / 180)} disabled={hasActiveGlue} title={hasActiveGlue ? 'Rotation locked by active Glue constraint' : ''} /></div>
                                                        <div>Z<input type="number" step="5" value={Math.round((selectedBoard.rotation || [0, 0, 0])[2] * 180 / Math.PI)} onChange={e => updateVector('rotation', 2, e.target.value * Math.PI / 180)} disabled={hasActiveGlue} title={hasActiveGlue ? 'Rotation locked by active Glue constraint' : ''} /></div>
                                                    </div>
                                                </div>
                                                <div className="inspector-section">
                                                    <h4>Active Constraints</h4>
                                                    {(() => {
                                                        const hasConstraints = (selectedBoard.constraints && selectedBoard.constraints.length > 0) || incomingConstraints.length > 0;

                                                        if (!hasConstraints) {
                                                            return <div className="hint" style={{ marginTop: 0 }}>No relational constraints set.</div>;
                                                        }

                                                        return (
                                                            <ul style={{ margin: '8px 0 16px 0', padding: 0, listStyle: 'none' }}>
                                                                {(selectedBoard.constraints || []).map((c, i) => {
                                                                    const targetBoard = boards.find(b => b.id.toString() === c.targetId.toString());
                                                                    const tName = targetBoard ? targetBoard.name : 'Unknown';
                                                                    return (
                                                                        <li key={`out_${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.1)', padding: '6px 10px', borderRadius: '6px', marginBottom: '4px', fontSize: '0.85rem', color: 'var(--text-main)', border: '1px solid var(--border-color)', opacity: c.enabled === false ? 0.5 : 1 }}>
                                                                            <span><strong>{c.type}</strong> → {tName}</span>
                                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                                {(c.type === 'Flush' || c.type === 'Glue') && (
                                                                                    <button onClick={() => {
                                                                                        pushHistory();
                                                                                        setBoards(prev => prev.map(b => {
                                                                                            if (b.id === selectedBoard.id) {
                                                                                                const result = solveAlignmentConstraint(b, c, prev);
                                                                                                return result ? { ...b, ...result } : b;
                                                                                            }
                                                                                            return b;
                                                                                        }));
                                                                                    }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }} title="Align Now">📐</button>
                                                                                )}
                                                                                <button onClick={() => {
                                                                                    pushHistory();
                                                                                    setBoards(prev => prev.map(b => b.id === selectedBoard.id ? { ...b, constraints: b.constraints.map((cc, idx) => idx === i ? { ...cc, enabled: cc.enabled === false ? true : false } : cc) } : b));
                                                                                }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }} title={c.enabled === false ? "Enable Constraint" : "Disable Constraint"}>{c.enabled === false ? '🔓' : '🔒'}</button>
                                                                                <button onClick={() => {
                                                                                    pushHistory();
                                                                                    setBoards(prev => prev.map(b => b.id === selectedBoard.id ? { ...b, constraints: b.constraints.filter((_, idx) => idx !== i) } : b));
                                                                                }} style={{ background: 'none', border: 'none', color: '#ff3b30', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
                                                                            </div>
                                                                        </li>
                                                                    );
                                                                })}
                                                                {incomingConstraints.map((item, i) => {
                                                                    const { sourceBoard, constraint, internalIndex } = item;
                                                                    return (
                                                                        <li key={`in_${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.1)', padding: '6px 10px', borderRadius: '6px', marginBottom: '4px', fontSize: '0.85rem', color: 'var(--text-main)', border: '1px solid var(--border-color)', opacity: constraint.enabled === false ? 0.5 : 1 }}>
                                                                            <span>{sourceBoard.name} → <strong>{constraint.type}</strong></span>
                                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                                {(constraint.type === 'Flush' || constraint.type === 'Glue') && (
                                                                                    <button onClick={() => {
                                                                                        pushHistory();
                                                                                        setBoards(prev => prev.map(b => {
                                                                                            if (b.id === sourceBoard.id) {
                                                                                                const result = solveAlignmentConstraint(b, constraint, prev);
                                                                                                return result ? { ...b, ...result } : b;
                                                                                            }
                                                                                            return b;
                                                                                        }));
                                                                                    }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }} title="Align Now">📐</button>
                                                                                )}
                                                                                <button onClick={() => {
                                                                                    pushHistory();
                                                                                    setBoards(prev => prev.map(b => b.id === sourceBoard.id ? { ...b, constraints: b.constraints.map((cc, idx) => idx === internalIndex ? { ...cc, enabled: cc.enabled === false ? true : false } : cc) } : b));
                                                                                }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }} title={constraint.enabled === false ? "Enable Constraint" : "Disable Constraint"}>{constraint.enabled === false ? '🔓' : '🔒'}</button>
                                                                                <button onClick={() => {
                                                                                    pushHistory();
                                                                                    setBoards(prev => prev.map(b => b.id === sourceBoard.id ? { ...b, constraints: b.constraints.filter((_, idx) => idx !== internalIndex) } : b));
                                                                                }} style={{ background: 'none', border: 'none', color: '#ff3b30', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
                                                                            </div>
                                                                        </li>
                                                                    );
                                                                })}
                                                            </ul>
                                                        );
                                                    })()}

                                                    {constraintTargetMode && constraintTargetMode.active ? (
                                                        <div style={{ padding: '12px', background: 'rgba(188, 138, 95, 0.1)', border: '1px dashed var(--accent-color)', borderRadius: '6px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--accent-color)' }}>
                                                            <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
                                                                {constraintTargetMode.step === 1 ? `Select Source Face on ${selectedBoard.name}...` : `Select Target Face on another board...`}
                                                            </div>
                                                            <button className="nav-btn" style={{ fontSize: '0.75rem', padding: '4px 8px' }} onClick={() => setConstraintTargetMode(null)}>Cancel</button>
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                                            <select
                                                                id="add_constraint_select"
                                                                style={{
                                                                    flex: 1, padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer',
                                                                    background: 'var(--bg-color)', color: 'var(--text-main)',
                                                                    border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none',
                                                                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
                                                                }}
                                                                value=""
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    if (val) {
                                                                        setConstraintTargetMode({ active: true, type: val, step: 1, sourceId: selectedBoard.id.toString(), sourceFace: null });
                                                                    }
                                                                }}
                                                            >
                                                                <option value="" disabled>+ Add Constraint...</option>
                                                                <option value="Glue">Glue To Face</option>
                                                                <option value="Flush">Make Flush</option>
                                                            </select>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="inspector-section">
                                                    <h4>Parent Node:</h4>
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '8px' }}><strong>{selectedBoard.parentId}</strong></div>
                                                </div>
                                                <div style={{ marginTop: '16px' }}>
                                                    <button
                                                        className="nav-btn"
                                                        style={{ width: '100%', padding: '8px', color: '#ff3b30', border: '1px solid rgba(255, 59, 48, 0.3)', background: 'rgba(255, 59, 48, 0.05)', fontWeight: 'bold', transition: 'background 0.2s' }}
                                                        onMouseEnter={e => e.target.style.background = 'rgba(255, 59, 48, 0.15)'}
                                                        onMouseLeave={e => e.target.style.background = 'rgba(255, 59, 48, 0.05)'}
                                                        onClick={handleComponentDelete}
                                                    >
                                                        Delete Component
                                                    </button>
                                                </div>
                                            </>
                                        );
                                    })()
                                ) : <div className="hint" style={{ marginTop: '0px' }}>Select a component in the outliner or viewport.</div>}
                            </DraggablePanel>
                        </div>
                    </aside>

                    {showCutlistPanel && (
                        <DraggablePanel title="Project Cut List" defaultPosition={{ x: 100, y: 100 }} defaultSize={{ width: 600 }}>
                            <div style={{ width: '100%', height: '100%', overflowY: 'auto', padding: '16px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-main)' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                                            <th style={{ padding: '8px' }}>Lumber</th>
                                            <th style={{ padding: '8px' }}>Component Name</th>
                                            <th style={{ padding: '8px' }}>Length (in)</th>
                                            <th style={{ padding: '8px' }}>Width (in)</th>
                                            <th style={{ padding: '8px' }}>Thickness (in)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {boards.map(b => {
                                            const dims = [...b.size].sort((x, y) => y - x); // [length, width, thickness]
                                            return (
                                                <tr key={b.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                    <td style={{ padding: '8px', textTransform: 'capitalize' }}>{b.material.replace('-', ' ')}</td>
                                                    <td style={{ padding: '8px' }}>{b.name}</td>
                                                    <td style={{ padding: '8px' }}>{dims[0].toFixed(4)}</td>
                                                    <td style={{ padding: '8px' }}>{dims[1].toFixed(4)}</td>
                                                    <td style={{ padding: '8px' }}>{dims[2].toFixed(4)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </DraggablePanel>
                    )}
                </main>



                {confirmDialog && (
                    <div className="app-overlay" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 10001, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'fixed', inset: 0 }} onClick={() => setConfirmDialog(null)}>
                        <div className="glass-panel" style={{ padding: '24px', width: '380px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }} onClick={e => e.stopPropagation()}>
                            <h3 style={{ margin: 0, color: '#ff3b30' }}>⚠ Confirm Deletion</h3>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.5 }}>{confirmDialog.message}</p>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                                <button className="nav-btn" style={{ padding: '8px 20px', border: '1px solid var(--border-color)' }} onClick={() => setConfirmDialog(null)}>Cancel</button>
                                <button className="nav-btn" style={{ padding: '8px 20px', background: 'rgba(255, 59, 48, 0.15)', color: '#ff3b30', border: '1px solid rgba(255, 59, 48, 0.3)', fontWeight: 'bold' }} onClick={confirmDialog.onConfirm}>Delete</button>
                            </div>
                        </div>
                    </div>
                )}

                {newBoardDialog && (
                    <div className="app-overlay" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'fixed', inset: 0 }}>
                        <div className="glass-panel" style={{ padding: '24px', width: '380px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <h2 style={{ margin: 0 }}>Add New Component</h2>

                            <div className="inspector-section" style={{ margin: 0 }}>
                                <h4>Component Name</h4>
                                <input type="text" value={newBoardDialog.name} onChange={e => setNewBoardDialog(p => ({ ...p, name: e.target.value }))} style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.15)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.9rem', outline: 'none' }} />
                            </div>

                            <div className="inspector-section" style={{ margin: 0 }}>
                                <h4>Parent Assembly</h4>
                                <select value={newBoardDialog.parentId} onChange={e => setNewBoardDialog(p => ({ ...p, parentId: e.target.value }))} style={{
                                    width: '100%', padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer',
                                    background: 'var(--bg-color)', color: 'var(--text-main)',
                                    border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none',
                                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
                                }}>
                                    <option value="Workspace">Workspace (Root)</option>
                                    {Object.keys(groups).map(g => (
                                        <option key={g} value={g}>{g}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="inspector-section" style={{ margin: 0 }}>
                                <h4>Positioning Plane</h4>
                                <select value={newBoardDialog.plane} onChange={e => setNewBoardDialog(p => ({ ...p, plane: e.target.value }))} style={{
                                    width: '100%', padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer',
                                    background: 'var(--bg-color)', color: 'var(--text-main)',
                                    border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none',
                                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
                                }}>
                                    <option value="red-green">Red-Green (XY) - Depth is Blue (Z)</option>
                                    <option value="red-blue">Red-Blue (XZ) - Depth is Green (Y)</option>
                                    <option value="green-blue">Green-Blue (YZ) - Depth is Red (X)</option>
                                </select>
                            </div>

                            <div className="inspector-section" style={{ margin: 0 }}>
                                <h4>Initial Dimensions (in)</h4>
                                <div className="vec3-inputs">
                                    <div title="Length">L<input type="number" step="0.5" value={newBoardDialog.dimL} onChange={e => { const v = parseFloat(e.target.value) || 0; setNewBoardDialog(p => ({ ...p, dimL: v })) }} /></div>
                                    <div title="Width">W<input type="number" step="0.5" value={newBoardDialog.dimW} onChange={e => { const v = parseFloat(e.target.value) || 0; setNewBoardDialog(p => ({ ...p, dimW: v })) }} /></div>
                                    <div title="Depth (Thickness)">D<input type="number" step="0.125" value={newBoardDialog.dimD} onChange={e => { const v = parseFloat(e.target.value) || 0; setNewBoardDialog(p => ({ ...p, dimD: v })) }} /></div>
                                </div>
                            </div>

                            <div className="inspector-section" style={{ margin: 0 }}>
                                <h4>Spawn Offset (in)</h4>
                                <div className="vec3-inputs">
                                    <div>X<input type="number" step="1" value={newBoardDialog.position[0]} onChange={e => { const v = parseFloat(e.target.value) || 0; setNewBoardDialog(p => ({ ...p, position: [v, p.position[1], p.position[2]] })) }} /></div>
                                    <div>Y<input type="number" step="1" value={newBoardDialog.position[1]} onChange={e => { const v = parseFloat(e.target.value) || 0; setNewBoardDialog(p => ({ ...p, position: [p.position[0], v, p.position[2]] })) }} /></div>
                                    <div>Z<input type="number" step="1" value={newBoardDialog.position[2]} onChange={e => { const v = parseFloat(e.target.value) || 0; setNewBoardDialog(p => ({ ...p, position: [p.position[0], p.position[1], v] })) }} /></div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                <button className="nav-btn" style={{ flex: 1, padding: '8px' }} onClick={() => setNewBoardDialog(null)}>Cancel</button>
                                <button className="primary-btn" style={{ flex: 1, padding: '8px' }} onClick={() => {
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
                                }}>Add Board</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
