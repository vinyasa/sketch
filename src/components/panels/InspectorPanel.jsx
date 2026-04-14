import React, { useState } from 'react';
import { computeWorldAABB, collectChildBoards } from '../../utils/sceneGraph';
import { normalizeMaterial, getMaterialDisplayColor, WOOD_CATALOGUE } from '../../utils/materialCatalogue';

import useStore from '../../store/useStore';

// Round to ≤4 decimal places, stripping trailing zeros
const fmt4 = (v) => parseFloat(v.toFixed(4));

const InspectorPanel = () => {
    const [cloneOffset, setCloneOffset] = useState(0.75);

    const {
        boards, groups, selectedItemIds, constraints,
        updateVector, moveGroup,
        setBoards, setGroups, setSelectedItemIds,
        pushHistory,
        dropBoardToFloor, dropGroupToFloor,
        handleAssemblyDelete, handleComponentDelete, handleMultiDelete,
        removeConstraint, toggleConstraint,
        constraintTargetMode, setConstraintTargetMode,
        updateProceduralBox
    } = useStore();

    const selectedBoard = selectedItemIds.length === 1 && boards.find(b => b.id.toString() === selectedItemIds[0]);
    const selectedGroup = selectedItemIds.length === 1 && Object.keys(groups).find(k => k === selectedItemIds[0]);

    // ─── Assembly (Group) Inspector ──────────────────────────────────────────
    if (selectedGroup !== undefined && selectedGroup !== false) {
        const isWorkspace = selectedGroup === 'Workspace';

        // Compute overall dimensions from child boards
        const childBoards = collectChildBoards(selectedGroup, boards, groups);
        let overallSize = [0, 0, 0];
        if (childBoards.length > 0) {
            const aabb = computeWorldAABB(childBoards);
            overallSize = [
                Math.abs(aabb.maxX - aabb.minX),
                Math.abs(aabb.maxY - aabb.minY),
                Math.abs(aabb.maxZ - aabb.minZ)
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
                            if (!newName.trim()) return; // don't allow empty names
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
                        <div style={{ backgroundColor: 'rgba(255, 60, 60, 0.15)' }}>X<input type="number" value={fmt4(overallSize[0])} disabled /></div>
                        <div style={{ backgroundColor: 'rgba(60, 200, 90, 0.15)' }}>Y<input type="number" value={fmt4(overallSize[1])} disabled /></div>
                        <div style={{ backgroundColor: 'rgba(60, 150, 255, 0.15)' }}>Z<input type="number" value={fmt4(overallSize[2])} disabled /></div>
                    </div>
                </div>
                {!isWorkspace && (
                    <div className="inspector-section">
                        <h4>Move Group (delta in)</h4>
                        <div className="vec3-inputs">
                            <div style={{ backgroundColor: 'rgba(255, 60, 60, 0.15)' }}>X<input type="number" step="0.5" defaultValue={0} onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== 0) { moveGroup(selectedGroup, 0, v); e.target.value = 0; }}} onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }} /></div>
                            <div style={{ backgroundColor: 'rgba(60, 200, 90, 0.15)' }}>Y<input type="number" step="0.5" defaultValue={0} onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== 0) { moveGroup(selectedGroup, 1, v); e.target.value = 0; }}} onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }} /></div>
                            <div style={{ backgroundColor: 'rgba(60, 150, 255, 0.15)' }}>Z<input type="number" step="0.5" defaultValue={0} onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== 0) { moveGroup(selectedGroup, 2, v); e.target.value = 0; }}} onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }} /></div>
                        </div>
                        <button style={{ marginTop: '8px', width: '100%' }} className="primary-btn" onClick={dropGroupToFloor}>↓ Set on Floor</button>
                        <p className="hint" style={{ marginTop: '6px' }}>Enter a delta value and press Enter to shift all children.</p>
                    </div>
                )}
                {groups[selectedGroup].meta && groups[selectedGroup].meta.type === 'procedural-box' && (
                    <div className="inspector-section" style={{ background: 'rgba(188, 138, 95, 0.1)', border: '1px solid rgba(188, 138, 95, 0.3)' }}>
                        <h4 style={{ color: 'var(--accent-color)' }}>Procedural Box Generator</h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>Joint Strategy:</span>
                            <button className="secondary-btn" style={{ padding: '4px 8px', fontSize: '0.8rem', minWidth: '100px' }} onClick={() => {
                                const cur = groups[selectedGroup].meta.joint;
                                const next = cur === 'butt-A' ? 'butt-B' : cur === 'butt-B' ? 'miter' : 'butt-A';
                                updateProceduralBox(selectedGroup, { joint: next });
                            }}>
                                {groups[selectedGroup].meta.joint === 'butt-A' ? 'Butt (Front/Back full)' : groups[selectedGroup].meta.joint === 'butt-B' ? 'Butt (Sides full)' : 'Miter'}
                            </button>
                        </div>
                        <p className="hint" style={{ marginTop: '6px' }}>Click to auto-recalculate all 4 walls.</p>
                    </div>
                )}
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
    }

    // ─── Multi-select ────────────────────────────────────────────────────────
    if (selectedItemIds.length > 1) {
        // Collect all boards that are part of this selection (direct boards + children of selected groups)
        const selectedBoardSet = new Set();
        selectedItemIds.forEach(id => {
            const board = boards.find(b => b.id.toString() === id);
            if (board) {
                selectedBoardSet.add(board);
            } else if (groups[id]) {
                collectChildBoards(id, boards, groups).forEach(b => selectedBoardSet.add(b));
            }
        });

        const selBoards = Array.from(selectedBoardSet);
        let multiSize = [0, 0, 0];
        let multiCenter = [0, 0, 0];
        if (selBoards.length > 0) {
            const aabb = computeWorldAABB(selBoards);
            multiSize = [
                fmt4(Math.abs(aabb.maxX - aabb.minX)),
                fmt4(Math.abs(aabb.maxY - aabb.minY)),
                fmt4(Math.abs(aabb.maxZ - aabb.minZ))
            ];
            multiCenter = [
                fmt4((aabb.minX + aabb.maxX) / 2),
                fmt4((aabb.minY + aabb.maxY) / 2),
                fmt4((aabb.minZ + aabb.maxZ) / 2)
            ];
        }

        return (
            <>
                <div className="inspector-title" style={{ marginBottom: '16px' }}>
                    <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>{selectedItemIds.length} Items Selected</span>
                </div>
                <div className="inspector-section">
                    <h4>Overall Bounding Box (in)</h4>
                    <div className="vec3-inputs">
                        <div style={{ backgroundColor: 'rgba(255, 60, 60, 0.15)' }}>X<input type="number" value={multiSize[0]} disabled /></div>
                        <div style={{ backgroundColor: 'rgba(60, 200, 90, 0.15)' }}>Y<input type="number" value={multiSize[1]} disabled /></div>
                        <div style={{ backgroundColor: 'rgba(60, 150, 255, 0.15)' }}>Z<input type="number" value={multiSize[2]} disabled /></div>
                    </div>
                </div>
                <div className="inspector-section">
                    <h4>Bounding Box Center (in)</h4>
                    <div className="vec3-inputs">
                        <div style={{ backgroundColor: 'rgba(255, 60, 60, 0.15)' }}>X<input type="number" value={multiCenter[0]} disabled /></div>
                        <div style={{ backgroundColor: 'rgba(60, 200, 90, 0.15)' }}>Y<input type="number" value={multiCenter[1]} disabled /></div>
                        <div style={{ backgroundColor: 'rgba(60, 150, 255, 0.15)' }}>Z<input type="number" value={multiCenter[2]} disabled /></div>
                    </div>
                </div>
                <div className="inspector-section">
                    <p className="hint">{selBoards.length} board{selBoards.length !== 1 ? 's' : ''} in selection. Use AI Chat for bulk transforms.</p>
                </div>
                <div style={{ marginTop: '16px' }}>
                    <button
                        className="nav-btn"
                        style={{ width: '100%', padding: '8px', color: '#ff3b30', border: '1px solid rgba(255, 59, 48, 0.3)', background: 'rgba(255, 59, 48, 0.05)', fontWeight: 'bold', transition: 'background 0.2s' }}
                        onMouseEnter={e => e.target.style.background = 'rgba(255, 59, 48, 0.15)'}
                        onMouseLeave={e => e.target.style.background = 'rgba(255, 59, 48, 0.05)'}
                        onClick={handleMultiDelete}
                    >
                        Delete {selectedItemIds.length} Selected Items
                    </button>
                </div>
            </>
        );
    }

    // ─── Single Board Inspector ──────────────────────────────────────────────
    if (selectedBoard) {
        // Sort dimensions to show Length/Width/Thickness labels
        const sorted = [...selectedBoard.size].map((v, i) => ({ val: v, idx: i })).sort((a, b) => b.val - a.val);
        const dimLabels = ['Length', 'Width', 'Thickness'];

        // Find all constraints involving this board from the central index
        const boardConstraints = Object.entries(constraints || {}).filter(([_, c]) =>
            c.boardAId === selectedBoard.id.toString() || c.boardBId === selectedBoard.id.toString()
        );

        const handleClone = () => {
            if (!selectedBoard) return;
            // Clone along the thinnest axis direction
            const minSize = Math.min(...selectedBoard.size);
            const thickAxis = selectedBoard.size.indexOf(minSize);
            
            const maxId = Math.max(...boards.map(b => parseInt(b.id) || 0), 0);
            const newId = maxId + 1;
            
            const newPos = [...selectedBoard.position];
            newPos[thickAxis] += cloneOffset;
            
            const newBoard = {
                ...selectedBoard,
                id: newId,
                position: newPos,
                constraints: []
            };
            
            const match = selectedBoard.name.match(/^(.*?)(\sCopy\s\d+|\sCopy)?$/);
            const baseName = match ? match[1] : selectedBoard.name;
            let maxCopyIdx = 0;
            boards.forEach(b => {
                 const m = b.name.match(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} Copy (\\d+)$`));
                 if (m) maxCopyIdx = Math.max(maxCopyIdx, parseInt(m[1]));
                 else if (b.name === `${baseName} Copy`) maxCopyIdx = Math.max(maxCopyIdx, 1);
            });
            
            if (maxCopyIdx > 0) {
                newBoard.name = `${baseName} Copy ${maxCopyIdx + 1}`;
            } else {
                newBoard.name = `${baseName} Copy`;
            }
            
            pushHistory();
            setBoards([...boards, newBoard]);
            setSelectedItemIds([newId.toString()]);
        };

        return (
            <>
                <div className="inspector-title" style={{ marginBottom: '16px' }}>
                    <input type="text" value={selectedBoard.name} onChange={e => { const v = e.target.value; setBoards(prev => prev.map(b => b.id === selectedBoard.id ? { ...b, name: v } : b)); }} title="Click to rename component" style={{ width: '100%', background: 'rgba(128,128,128,0.15)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', color: 'var(--accent-color)', fontSize: 'inherit', fontWeight: 'inherit', outline: 'none' }} />
                </div>
                <div className="inspector-section">
                    <h4>Size (in)</h4>
                    <div className="vec3-inputs">
                        <div style={{ backgroundColor: 'rgba(255, 60, 60, 0.15)' }}>X<input type="number" step="0.5" value={fmt4(selectedBoard.size[0])} onChange={e => updateVector('size', 0, e.target.value)} /></div>
                        <div style={{ backgroundColor: 'rgba(60, 200, 90, 0.15)' }}>Y<input type="number" step="0.5" value={fmt4(selectedBoard.size[1])} onChange={e => updateVector('size', 1, e.target.value)} /></div>
                        <div style={{ backgroundColor: 'rgba(60, 150, 255, 0.15)' }}>Z<input type="number" step="0.5" value={fmt4(selectedBoard.size[2])} onChange={e => updateVector('size', 2, e.target.value)} /></div>
                    </div>
                    <div className="hint" style={{ marginTop: '6px', fontSize: '0.75rem' }}>
                        {sorted.map((d, i) => `${dimLabels[i]}: ${d.val.toFixed(2)}" (${['X','Y','Z'][d.idx]})`).join(' · ')}
                    </div>
                </div>
                <div className="inspector-section">
                    <h4>Position (in)</h4>
                    <div className="vec3-inputs">
                        <div style={{ backgroundColor: 'rgba(255, 60, 60, 0.15)' }}>X<input type="number" step="0.125" value={fmt4(selectedBoard.position[0])} onChange={e => updateVector('position', 0, e.target.value)} /></div>
                        <div style={{ backgroundColor: 'rgba(60, 200, 90, 0.15)' }}>Y<input type="number" step="0.125" value={fmt4(selectedBoard.position[1])} onChange={e => updateVector('position', 1, e.target.value)} /></div>
                        <div style={{ backgroundColor: 'rgba(60, 150, 255, 0.15)' }}>Z<input type="number" step="0.125" value={fmt4(selectedBoard.position[2])} onChange={e => updateVector('position', 2, e.target.value)} /></div>
                    </div>
                    <button style={{ marginTop: '8px', width: '100%' }} className="primary-btn" onClick={dropBoardToFloor}>↓ Set on Floor</button>
                </div>
                {/* ── Material ── */}
                {(() => {
                    const mat = normalizeMaterial(selectedBoard.material);
                    const swatchColor = getMaterialDisplayColor(selectedBoard.material);
                    const label = mat.type === 'color'
                        ? 'Paint'
                        : (WOOD_CATALOGUE[mat.id]?.label ?? mat.id);
                    return (
                        <div className="inspector-section">
                            <h4>Material</h4>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                                <div style={{
                                    width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0,
                                    background: swatchColor,
                                    border: '1px solid var(--border-color)',
                                    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)',
                                }} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>{label}</span>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                        {mat.type === 'color' ? mat.hex : 'Wood'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })()}
                {/* ── Joint ── */}
                {(() => {
                    // ── Color theme per joint state ───────────────────────────
                    const JOINT_SEQ  = ['Miter', 'Butt 1', 'Butt 2'];
                    const JOINT_DESC = {
                        'Miter':  'Panels overlap — click to make this piece run full',
                        'Butt 1': 'This piece runs full, neighbours trimmed — click to swap',
                        'Butt 2': 'This piece is trimmed, neighbours run full — click to restore',
                    };
                    const JOINT_COLOR  = { 'Miter': 'rgba(150,95,188,0.18)',  'Butt 1': 'rgba(188,138,95,0.18)',  'Butt 2': 'rgba(95,150,188,0.18)' };
                    const JOINT_BORDER = { 'Miter': 'rgba(150,95,188,0.7)',   'Butt 1': 'rgba(188,138,95,0.7)',   'Butt 2': 'rgba(95,150,188,0.7)'  };
                    const JOINT_TEXT   = { 'Miter': '#9a60c0',                'Butt 1': '#bc8a5f',                'Butt 2': '#5fa0c0'               };

                    // ── AABB helpers ──────────────────────────────────────────
                    const bbOf = (b) => [0, 1, 2].map(i => ({
                        min: b.position[i] - b.size[i] / 2,
                        max: b.position[i] + b.size[i] / 2,
                    }));
                    const thinAxis = (b) => b.size.indexOf(Math.min(...b.size));
                    const overlaps = (a, b) => {
                        const ba = bbOf(a), bb = bbOf(b);
                        return [0, 1, 2].every(i =>
                            Math.min(ba[i].max, bb[i].max) - Math.max(ba[i].min, bb[i].min) > 0.01
                        );
                    };

                    // ── Detect current state from geometry ────────────────────
                    const siblings = boards.filter(b =>
                        b.id !== selectedBoard.id && b.parentId === selectedBoard.parentId
                    );
                    const overlapNeighbors = siblings.filter(s => overlaps(selectedBoard, s));
                    const cur = overlapNeighbors.length > 0
                        ? 'Miter'
                        : (JOINT_SEQ.includes(selectedBoard.joint) ? selectedBoard.joint : 'Butt 1');
                    const next = JOINT_SEQ[(JOINT_SEQ.indexOf(cur) + 1) % JOINT_SEQ.length];

                    // ── Geometric joint application ───────────────────────────
                    const handleJoint = () => {
                        pushHistory();
                        const axisA = thinAxis(selectedBoard);
                        let bds = [...boards];

                        if (cur === 'Miter') {
                            // → Butt 1: A stays full, trim all overlapping neighbours
                            //   along A's own thin axis so they stop at A's inner face.
                            const ba = bbOf(selectedBoard);
                            for (const nb of overlapNeighbors) {
                                const bb = bbOf(nb);
                                const t = { ...nb, size: [...nb.size], position: [...nb.position] };
                                if (bb[axisA].max > ba[axisA].min && bb[axisA].max <= ba[axisA].max + 0.01) {
                                    // Neighbour's max protrudes into A → trim its max to A's inner face
                                    const nMax = ba[axisA].min;
                                    t.size[axisA]     = Math.max(0.1, nMax - bb[axisA].min);
                                    t.position[axisA] = (bb[axisA].min + nMax) / 2;
                                } else {
                                    // Neighbour's min protrudes into A → trim its min to A's inner face
                                    const nMin = ba[axisA].max;
                                    t.size[axisA]     = Math.max(0.1, bb[axisA].max - nMin);
                                    t.position[axisA] = (nMin + bb[axisA].max) / 2;
                                }
                                t.joint = 'Butt 1';
                                bds = bds.map(b => b.id === nb.id ? t : b);
                            }
                            bds = bds.map(b => b.id === selectedBoard.id ? { ...b, joint: 'Butt 1' } : b);

                        } else if (cur === 'Butt 1') {
                            // → Butt 2
                            // Step 1: restore neighbours — they were trimmed along axisA,
                            //   with their trimmed end touching A's inner face. Extend back.
                            const ba   = bbOf(selectedBoard);
                            const thiccA = selectedBoard.size[axisA];
                            for (const nb of siblings) {
                                const bb = bbOf(nb);
                                const t  = { ...nb, size: [...nb.size], position: [...nb.position] };
                                if (Math.abs(bb[axisA].max - ba[axisA].min) < 0.06) {
                                    t.size[axisA]     += thiccA;
                                    t.position[axisA] += thiccA / 2;
                                } else if (Math.abs(bb[axisA].min - ba[axisA].max) < 0.06) {
                                    t.size[axisA]     += thiccA;
                                    t.position[axisA] -= thiccA / 2;
                                } else { continue; }
                                t.joint = 'Butt 2';
                                bds = bds.map(b => b.id === nb.id ? t : b);
                            }
                            // Step 2: trim A along every restored neighbour's own thin axis.
                            //   Track A's running bbox as each trim is applied sequentially.
                            let ua = { ...selectedBoard, size: [...selectedBoard.size], position: [...selectedBoard.position] };
                            for (const nb of siblings) {
                                const nbLatest = bds.find(b => b.id === nb.id) ?? nb;
                                const axisB    = thinAxis(nbLatest);
                                const baCur    = bbOf(ua);
                                const bb       = bbOf(nbLatest);
                                if (baCur[axisB].max > bb[axisB].min + 0.01 && baCur[axisB].max <= bb[axisB].max + 0.01) {
                                    const nMax = bb[axisB].min;
                                    ua = { ...ua, size: [...ua.size], position: [...ua.position] };
                                    ua.size[axisB]     = Math.max(0.1, nMax - baCur[axisB].min);
                                    ua.position[axisB] = (baCur[axisB].min + nMax) / 2;
                                } else if (baCur[axisB].min < bb[axisB].max - 0.01 && baCur[axisB].min >= bb[axisB].min - 0.01) {
                                    const nMin = bb[axisB].max;
                                    ua = { ...ua, size: [...ua.size], position: [...ua.position] };
                                    ua.size[axisB]     = Math.max(0.1, baCur[axisB].max - nMin);
                                    ua.position[axisB] = (nMin + baCur[axisB].max) / 2;
                                }
                            }
                            ua.joint = 'Butt 2';
                            bds = bds.map(b => b.id === selectedBoard.id ? ua : b);

                        } else if (cur === 'Butt 2') {
                            // → Miter: restore A by extending it wherever it touches a
                            //   neighbour's inner face along that neighbour's thin axis.
                            let ua = { ...selectedBoard, size: [...selectedBoard.size], position: [...selectedBoard.position] };
                            for (const nb of siblings) {
                                const axisB  = thinAxis(nb);
                                const thiccB = nb.size[axisB];
                                const bb     = bbOf(nb);
                                const baCur  = bbOf(ua);
                                if (Math.abs(baCur[axisB].max - bb[axisB].min) < 0.06) {
                                    ua = { ...ua, size: [...ua.size], position: [...ua.position] };
                                    ua.size[axisB]     += thiccB;
                                    ua.position[axisB] += thiccB / 2;
                                } else if (Math.abs(baCur[axisB].min - bb[axisB].max) < 0.06) {
                                    ua = { ...ua, size: [...ua.size], position: [...ua.position] };
                                    ua.size[axisB]     += thiccB;
                                    ua.position[axisB] -= thiccB / 2;
                                }
                            }
                            ua.joint = 'Miter';
                            bds = bds.map(b => b.id === selectedBoard.id ? ua : b);
                        }

                        setBoards(bds);
                    };

                    return (
                        <div className="inspector-section">
                            <h4>Joint</h4>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                <button
                                    style={{
                                        padding: '5px 14px', fontSize: '0.75rem', fontWeight: 700, minWidth: '82px',
                                        borderRadius: '6px', border: `1px solid ${JOINT_BORDER[cur]}`,
                                        background: JOINT_COLOR[cur], color: JOINT_TEXT[cur],
                                        cursor: 'pointer', letterSpacing: '0.3px', transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.2)'}
                                    onMouseLeave={e => e.currentTarget.style.filter = ''}
                                    onClick={handleJoint}
                                >
                                    {cur}
                                </button>
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                                    {JOINT_DESC[cur]}
                                </span>
                            </div>
                        </div>
                    );
                })()}
                <div className="inspector-section">
                    <h4>Active Constraints</h4>
                    {boardConstraints.length === 0 ? (
                        <div className="hint" style={{ marginTop: 0 }}>No relational constraints set.</div>
                    ) : (
                        <ul style={{ margin: '8px 0 16px 0', padding: 0, listStyle: 'none' }}>
                            {boardConstraints.map(([cId, c]) => {
                                const isA = c.boardAId === selectedBoard.id.toString();
                                const partnerId = isA ? c.boardBId : c.boardAId;
                                const partner = boards.find(b => b.id.toString() === partnerId);
                                const partnerName = partner?.name ?? partnerId;
                                const axisLabel = c.type === 'Flush' ? ` (${['X','Y','Z'][c.axis]} axis)` : '';
                                return (
                                    <li key={cId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.1)', padding: '6px 10px', borderRadius: '6px', marginBottom: '4px', fontSize: '0.85rem', color: 'var(--text-main)', border: '1px solid var(--border-color)', opacity: c.enabled === false ? 0.5 : 1 }}>
                                        <span><strong>{c.type}</strong>{axisLabel} ↔ {partnerName}</span>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => toggleConstraint(cId)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }} title={c.enabled === false ? 'Enable' : 'Disable'}>{c.enabled === false ? '🔓' : '🔒'}</button>
                                            <button onClick={() => removeConstraint(cId)} style={{ background: 'none', border: 'none', color: '#ff3b30', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>×</button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {constraintTargetMode && constraintTargetMode.active ? (
                        <div style={{ padding: '12px', background: 'rgba(188, 138, 95, 0.1)', border: '1px dashed var(--accent-color)', borderRadius: '6px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--accent-color)' }}>
                            <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
                                {constraintTargetMode.type === 'Glue'
                                    ? `Click another board to glue to "${selectedBoard.name}"...`
                                    : constraintTargetMode.step === 1
                                        ? `Select Source Face on ${selectedBoard.name}...`
                                        : `Select Target Face on another board...`
                                }
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
                                <option value="Glue">Glue To Board</option>
                                <option value="Flush">Make Flush</option>
                            </select>
                        </div>
                    )}
                </div>
                <div className="inspector-section">
                    <h4>Parent Node:</h4>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '8px' }}><strong>{selectedBoard.parentId}</strong></div>
                </div>
                <div className="inspector-section">
                    <h4>Clone Component</h4>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                        <span style={{ fontSize: '0.82rem' }}>Offset (in):</span>
                        <input type="number" step="0.125" value={cloneOffset} onChange={e => setCloneOffset(Number(e.target.value))} style={{ width: '60px', padding: '4px', background: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '4px' }} />
                        <button className="primary-btn" style={{ flex: 1, padding: '4px 0', fontSize: '0.9rem' }} onClick={handleClone}>Clone Along Thin Axis</button>
                    </div>
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
    }

    return <div className="hint" style={{ marginTop: '0px' }}>Select a component in the outliner or viewport.</div>;
};

export default InspectorPanel;
