import React, { useState, useEffect } from 'react';
import { computeWorldAABB, collectChildBoards } from '../../utils/sceneGraph';
import { normalizeMaterial, getMaterialDisplayColor, WOOD_CATALOGUE } from '../../utils/materialCatalogue';
import { taperValidation, normalizeTaper } from '../../utils/geometryBuilders';

import useStore from '../../store/useStore';

// ── Build a compact summary string for each tool type ────────────────────────
function getToolSummary(op) {
    switch (op.type) {
        case 'dado':
            return `${op.face || 'top'} surface · along ${(op.direction || 'x').toUpperCase()}`;
        case 'hole':
            return `r=${(op.radius ?? 0).toFixed(2)}" · ${(op.axis || 'y').toUpperCase()} axis`;
        case 'cove':
            return `${op.edge || 'top'} edge · ${(op.axis || 'y').toUpperCase()} axis`;
        case 'arc':
            return `${op.startAngle ?? 0}°–${op.endAngle ?? 90}° · ${(op.axis || 'y').toUpperCase()} axis`;
        case 'miter': {
            const fl = { 'z+': 'Front', 'z-': 'Back', 'x+': 'Right', 'x-': 'Left' }[op.face] || op.face;
            const bv = op.bevel ?? 0;
            return `${fl} end · ${op.angle ?? 45}°${bv > 0 ? ` · Bevel ${bv}°` : ''}`;
        }
        default:
            return op.type;
    }
}

// Round to ≤4 decimal places, stripping trailing zeros
const fmt4 = (v) => parseFloat(v.toFixed(4));

const InspectorPanel = () => {
    const [cloneOffset, setCloneOffset] = useState(0.75);
    const [bulkAngleZ, setBulkAngleZ] = useState(2);
    const [bulkAngleX, setBulkAngleX] = useState(2);
    const [bulkDelta, setBulkDelta] = useState(['0', '0', '0']);
    const [rotationStep, setRotationStep] = useState(5);

    const {
        boards, groups, selectedItemIds, constraints,
        updateVector, moveGroup,
        setBoards, setGroups, setSelectedItemIds,
        pushHistory,
        dropBoardToFloor, dropGroupToFloor, dropSelectionToFloor,
        incrementRotation, resetRotation,
        handleAssemblyDelete, handleComponentDelete, handleMultiDelete,
        removeConstraint, toggleConstraint,
        constraintTargetMode, setConstraintTargetMode,
        updateProceduralBox,
        removeOperation,
        setComputingMessage,
        showToolsPanel, setShowToolsPanel, setEditingToolOpId,
        toggleRabbetJoint, removeRabbetJoint,
    } = useStore();

    const selectedBoardId = selectedItemIds?.[0];

    // Cancel constraint mode if selection no longer includes the source board
    useEffect(() => {
        if (constraintTargetMode?.active && constraintTargetMode.sourceId) {
            const sourceStillSelected = selectedItemIds.includes(constraintTargetMode.sourceId);
            if (!sourceStillSelected) setConstraintTargetMode(null);
        }
    }, [selectedItemIds, constraintTargetMode, setConstraintTargetMode]);

    // Escape key cancels constraint mode
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape' && constraintTargetMode?.active) setConstraintTargetMode(null); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [constraintTargetMode, setConstraintTargetMode]);

    const selectedBoard = selectedItemIds.length === 1 && boards.find(b => b.id.toString() === selectedItemIds[0]);
    const selectedGroup = selectedItemIds.length === 1 && Object.keys(groups).find(k => k === selectedItemIds[0]);

    // Sticky banner — always rendered when constraint pick mode is active
    const ConstraintBanner = constraintTargetMode?.active ? (
        <div style={{
            padding: '10px 12px', marginBottom: '12px',
            background: 'rgba(188, 138, 95, 0.12)',
            border: '1px dashed var(--accent-color)',
            borderRadius: '8px', textAlign: 'center',
        }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-color)', marginBottom: '6px' }}>
                {constraintTargetMode.type === 'Glue'
                    ? `Click a board to glue to…`
                    : constraintTargetMode.step === 1
                        ? `Click a face on the source board…`
                        : `Click a face on the target board…`
                }
            </div>
            <button className="nav-btn"
                style={{ fontSize: '0.72rem', padding: '3px 10px', border: '1px solid var(--accent-color)' }}
                onClick={() => setConstraintTargetMode(null)}>
                Cancel (Esc)
            </button>
        </div>
    ) : null;

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
                {ConstraintBanner}
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
                            <div style={{ backgroundColor: 'rgba(255, 60, 60, 0.15)' }}>X<input type="number" step="0.5" defaultValue={0} onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== 0) { moveGroup(selectedGroup, 0, v); e.target.value = 0; } }} onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }} /></div>
                            <div style={{ backgroundColor: 'rgba(60, 200, 90, 0.15)' }}>Y<input type="number" step="0.5" defaultValue={0} onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== 0) { moveGroup(selectedGroup, 1, v); e.target.value = 0; } }} onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }} /></div>
                            <div style={{ backgroundColor: 'rgba(60, 150, 255, 0.15)' }}>Z<input type="number" step="0.5" defaultValue={0} onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== 0) { moveGroup(selectedGroup, 2, v); e.target.value = 0; } }} onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }} /></div>
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
        let aabb = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
        let multiSize = [0, 0, 0];
        if (selBoards.length > 0) {
            aabb = computeWorldAABB(selBoards);
            multiSize = [
                fmt4(Math.abs(aabb.maxX - aabb.minX)),
                fmt4(Math.abs(aabb.maxY - aabb.minY)),
                fmt4(Math.abs(aabb.maxZ - aabb.minZ))
            ];
        }

        // For each axis: which boards have both extents touching the group AABB?
        const SNAP = 0.01;
        const aabbMins = [aabb.minX, aabb.minY, aabb.minZ];
        const aabbMaxs = [aabb.maxX, aabb.maxY, aabb.maxZ];
        const spanningBoards = [0, 1, 2].map(i =>
            selBoards.filter(b => {
                const bMin = b.position[i] - b.size[i] / 2;
                const bMax = b.position[i] + b.size[i] / 2;
                return Math.abs(bMin - aabbMins[i]) < SNAP && Math.abs(bMax - aabbMaxs[i]) < SNAP;
            })
        );
        const axisEditable = spanningBoards.map(s => s.length > 0);

        const handleBBSizeChange = (i, newVal) => {
            const v = parseFloat(newVal);
            if (isNaN(v) || v <= 0) return;
            pushHistory();
            const spanIds = new Set(spanningBoards[i].map(b => b.id));
            setBoards(prev => prev.map(b => {
                if (!spanIds.has(b.id)) return b;
                const newSize = [...b.size];
                newSize[i] = v;
                const newPos = [...b.position];
                newPos[i] = aabbMins[i] + v / 2; // anchor to min-extent side
                return { ...b, size: newSize, position: newPos };
            }));
        };

        const applyBulkMove = () => {
            const [dx, dy, dz] = bulkDelta.map(v => parseFloat(v) || 0);
            if (dx === 0 && dy === 0 && dz === 0) return;
            pushHistory();
            const selIds = new Set(selBoards.map(b => b.id));
            setBoards(prev => prev.map(b =>
                selIds.has(b.id)
                    ? { ...b, position: [b.position[0] + dx, b.position[1] + dy, b.position[2] + dz] }
                    : b
            ));
            setBulkDelta(['0', '0', '0']);
        };

        const bbRowStyle = (editable) => ({
            opacity: editable ? 1 : 0.4,
            transition: 'opacity 0.15s',
        });

        return (
            <>
                {ConstraintBanner}
                <div className="inspector-title" style={{ marginBottom: '16px' }}>
                    <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>{selectedItemIds.length} Items Selected</span>
                </div>
                <div className="inspector-section">
                    <h4>Bounding Box (in)</h4>
                    <p className="hint" style={{ marginTop: '2px', marginBottom: '6px' }}>
                        Editable axes span all selected boards.
                    </p>
                    <div className="vec3-inputs">
                        <div style={{ backgroundColor: 'rgba(255, 60, 60, 0.15)', ...bbRowStyle(axisEditable[0]) }}>
                            X<input type="number" step="0.125" value={multiSize[0]}
                                disabled={!axisEditable[0]}
                                onChange={e => handleBBSizeChange(0, e.target.value)} />
                        </div>
                        <div style={{ backgroundColor: 'rgba(60, 200, 90, 0.15)', ...bbRowStyle(axisEditable[1]) }}>
                            Y<input type="number" step="0.125" value={multiSize[1]}
                                disabled={!axisEditable[1]}
                                onChange={e => handleBBSizeChange(1, e.target.value)} />
                        </div>
                        <div style={{ backgroundColor: 'rgba(60, 150, 255, 0.15)', ...bbRowStyle(axisEditable[2]) }}>
                            Z<input type="number" step="0.125" value={multiSize[2]}
                                disabled={!axisEditable[2]}
                                onChange={e => handleBBSizeChange(2, e.target.value)} />
                        </div>
                    </div>
                    {axisEditable.some(Boolean) && (
                        <div style={{ marginTop: '5px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {['X', 'Y', 'Z'].map((label, i) => axisEditable[i]
                                ? <span key={i} style={{ marginRight: '8px' }}>{label}: {spanningBoards[i].length} board{spanningBoards[i].length !== 1 ? 's' : ''}</span>
                                : null
                            )}
                        </div>
                    )}
                </div>
                <div className="inspector-section">
                    <h4>Move by Δ (in)</h4>
                    <div className="vec3-inputs">
                        <div style={{ backgroundColor: 'rgba(255, 60, 60, 0.15)' }}>X<input type="number" step="0.125" value={bulkDelta[0]} onChange={e => setBulkDelta([e.target.value, bulkDelta[1], bulkDelta[2]])} /></div>
                        <div style={{ backgroundColor: 'rgba(60, 200, 90, 0.15)' }}>Y<input type="number" step="0.125" value={bulkDelta[1]} onChange={e => setBulkDelta([bulkDelta[0], e.target.value, bulkDelta[2]])} /></div>
                        <div style={{ backgroundColor: 'rgba(60, 150, 255, 0.15)' }}>Z<input type="number" step="0.125" value={bulkDelta[2]} onChange={e => setBulkDelta([bulkDelta[0], bulkDelta[1], e.target.value])} /></div>
                    </div>
                    <button style={{ marginTop: '8px', width: '100%' }} className="primary-btn" onClick={applyBulkMove}>
                        Apply Move
                    </button>
                </div>
                <div className="inspector-section">
                    <p className="hint">{selBoards.length} board{selBoards.length !== 1 ? 's' : ''} in selection. Use AI Chat for bulk transforms.</p>
                    <button style={{ marginTop: '8px', width: '100%' }} className="primary-btn" onClick={dropSelectionToFloor}>↓ Set on Floor</button>
                </div>
                {selBoards.length >= 2 && (() => {
                    // Centroid across all selected boards in X and Z
                    const cx = selBoards.reduce((s, b) => s + b.position[0], 0) / selBoards.length;
                    const cz = selBoards.reduce((s, b) => s + b.position[2], 0) / selBoards.length;

                    // Determine which sides face inward toward the centroid
                    const applyTaper = (angle) => {
                        pushHistory();
                        const selIds = new Set(selBoards.map(b => b.id));
                        setBoards(prev => prev.map(b => {
                            if (!selIds.has(b.id)) return b;
                            // Each leg gets inward-facing sides tapered
                            const taper = {
                                angleLeft:  b.position[0] > cx ? angle : 0,
                                angleRight: b.position[0] < cx ? angle : 0,
                                angleFront: b.position[2] < cz ? angle : 0,
                                angleBack:  b.position[2] > cz ? angle : 0,
                            };
                            return { ...b, shape: 'taper', taper };
                        }));
                    };

                    const removeTaper = () => {
                        pushHistory();
                        const selIds = new Set(selBoards.map(b => b.id));
                        setBoards(prev => prev.map(b =>
                            selIds.has(b.id) ? { ...b, shape: undefined, taper: undefined } : b
                        ));
                    };

                    const allTapered = selBoards.every(b => b.shape === 'taper');

                    return (
                        <div className="inspector-section" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                            <h4>Bulk Shape</h4>
                            <p className="hint" style={{ marginTop: '2px', marginBottom: '8px' }}>
                                Inward-facing sides are auto-detected from each board's position relative to the group centroid.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Taper angle (°)</div>
                                    <input
                                        type="number" min="0" max="89" step="0.5"
                                        value={bulkAngleZ}
                                        onChange={e => setBulkAngleZ(Math.max(0, Math.min(89, parseFloat(e.target.value) || 0)))}
                                        style={{ width: '100%', padding: '5px 8px', background: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none', fontSize: '0.9rem' }}
                                    />
                                </div>
                                <button className="primary-btn" onClick={() => applyTaper(bulkAngleZ)}>
                                    ◢ Taper as Legs ({bulkAngleZ}°)
                                </button>
                                {allTapered && (
                                    <button className="nav-btn" style={{ border: '1px solid var(--border-color)', marginTop: '2px' }} onClick={removeTaper}>
                                        ■ Remove Taper → Box
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })()}
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
                {ConstraintBanner}
                <div className="inspector-title" style={{ marginBottom: '16px' }}>
                    <input type="text" value={selectedBoard.name} onChange={e => { const v = e.target.value; setBoards(prev => prev.map(b => b.id === selectedBoard.id ? { ...b, name: v } : b)); }} title="Click to rename component" style={{ width: '100%', background: 'rgba(128,128,128,0.15)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', color: 'var(--accent-color)', fontSize: 'inherit', fontWeight: 'inherit', outline: 'none' }} />
                </div>
                <div className="inspector-section">
                    <h4>Size (in)</h4>
                    <div className="vec3-inputs">
                        <div style={{ backgroundColor: 'rgba(255, 60, 60, 0.15)' }}>X<input type="number" step="0.125" value={fmt4(selectedBoard.size[0])} onChange={e => updateVector('size', 0, e.target.value)} /></div>
                        <div style={{ backgroundColor: 'rgba(60, 200, 90, 0.15)' }}>Y<input type="number" step="0.125" value={fmt4(selectedBoard.size[1])} onChange={e => updateVector('size', 1, e.target.value)} /></div>
                        <div style={{ backgroundColor: 'rgba(60, 150, 255, 0.15)' }}>Z<input type="number" step="0.125" value={fmt4(selectedBoard.size[2])} onChange={e => updateVector('size', 2, e.target.value)} /></div>
                    </div>
                    <div className="hint" style={{ marginTop: '6px', fontSize: '0.75rem' }}>
                        {sorted.map((d, i) => `${dimLabels[i]}: ${d.val.toFixed(2)}" (${['X', 'Y', 'Z'][d.idx]})`).join(' · ')}
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
                <div className="inspector-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4>Local Orientation</h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-color)', opacity: 0.8 }}>Step:</span>
                            <input type="number" step="1" value={rotationStep} onChange={e => setRotationStep(parseFloat(e.target.value) || 0)} style={{ width: '40px', padding: '2px', fontSize: '0.7rem' }} />
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-color)', opacity: 0.8 }}>°</span>
                        </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginTop: '6px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ fontSize: '0.65rem', textAlign: 'center', color: '#ff3b30', fontWeight: 'bold' }}>Pitch (X)</div>
                            <div style={{ display: 'flex', gap: '2px' }}>
                                <button className="nav-btn" style={{ flex: 1, padding: '4px 0' }} onClick={() => incrementRotation(0, -rotationStep)}>-</button>
                                <button className="nav-btn" style={{ flex: 1, padding: '4px 0' }} onClick={() => incrementRotation(0, rotationStep)}>+</button>
                            </div>
                            <button className="nav-btn" style={{ padding: '2px 0', fontSize: '0.6rem' }} onClick={() => incrementRotation(0, 180)}>Flip 180</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ fontSize: '0.65rem', textAlign: 'center', color: '#3cc85a', fontWeight: 'bold' }}>Yaw (Y)</div>
                            <div style={{ display: 'flex', gap: '2px' }}>
                                <button className="nav-btn" style={{ flex: 1, padding: '4px 0' }} onClick={() => incrementRotation(1, -rotationStep)}>-</button>
                                <button className="nav-btn" style={{ flex: 1, padding: '4px 0' }} onClick={() => incrementRotation(1, rotationStep)}>+</button>
                            </div>
                            <button className="nav-btn" style={{ padding: '2px 0', fontSize: '0.6rem' }} onClick={() => incrementRotation(1, 180)}>Spin 180</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ fontSize: '0.65rem', textAlign: 'center', color: '#3c96ff', fontWeight: 'bold' }}>Roll (Z)</div>
                            <div style={{ display: 'flex', gap: '2px' }}>
                                <button className="nav-btn" style={{ flex: 1, padding: '4px 0' }} onClick={() => incrementRotation(2, -rotationStep)}>-</button>
                                <button className="nav-btn" style={{ flex: 1, padding: '4px 0' }} onClick={() => incrementRotation(2, rotationStep)}>+</button>
                            </div>
                            <button className="nav-btn" style={{ padding: '2px 0', fontSize: '0.6rem' }} onClick={() => incrementRotation(2, 180)}>Flip 180</button>
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                        <button className="nav-btn"
                            title="Reset orientation to 0° on all axes"
                            style={{ padding: '3px 7px', fontSize: '0.68rem', border: '1px solid var(--border-color)' }}
                            onClick={resetRotation}>
                            Reset Orientation
                        </button>
                    </div>
                    <p className="hint" style={{ marginTop: '6px' }}>Orientation is local — operations (miter, dado, etc.) stay on their original faces.</p>
                </div>

                    {/* ── Shape Picker ── */}
                <div className="inspector-card">
                    <h4>Shape</h4>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {['box', 'taper', 'cylinder'].map(s => (
                            <button
                                key={s}
                                onClick={() => {
                                    pushHistory();
                                    let patch;
                                    if (s === 'box') {
                                        patch = { shape: undefined, taper: undefined, cylinder: undefined };
                                    } else if (s === 'taper') {
                                        patch = { shape: 'taper', taper: { angleLeft: 2, angleRight: 2, angleFront: 2, angleBack: 2 }, cylinder: undefined };
                                    } else if (s === 'cylinder') {
                                        const r = Math.min(selectedBoard.size[0], selectedBoard.size[2]) / 2;
                                        const h = selectedBoard.size[1];
                                        patch = { shape: 'cylinder', cylinder: { radius: r, axis: 'y' }, size: [r * 2, h, r * 2], taper: undefined };
                                    }
                                    setBoards(prev => prev.map(bd =>
                                        bd.id === selectedBoard.id ? { ...bd, ...patch } : bd
                                    ));
                                }}
                                style={{
                                    padding: '5px 14px',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    borderRadius: '6px',
                                    border: (selectedBoard.shape ?? 'box') === s
                                        ? '1px solid rgba(188,138,95,0.8)'
                                        : '1px solid var(--border-color)',
                                    background: (selectedBoard.shape ?? 'box') === s
                                        ? 'rgba(188,138,95,0.2)'
                                        : 'transparent',
                                    color: (selectedBoard.shape ?? 'box') === s
                                        ? 'var(--accent-color)'
                                        : 'var(--text-muted)',
                                    cursor: 'pointer',
                                    textTransform: 'capitalize',
                                    transition: 'all 0.15s',
                                }}
                            >
                                {s === 'box' ? '■ Box' : s === 'taper' ? '◢ Taper' : '○ Cylinder'}
                            </button>
                        ))}
                    </div>

                    {selectedBoard.shape === 'taper' && (() => {
                        const { angleLeft: aL, angleRight: aR, angleFront: aF, angleBack: aB } = normalizeTaper(selectedBoard.taper);
                        const { xBottom, zBottom, xWarn, zWarn } = taperValidation(
                            selectedBoard.size[0], selectedBoard.size[1], selectedBoard.size[2], aL, aR, aF, aB
                        );
                        const setAngle = (key, val) => {
                            const v = Math.max(0, Math.min(89, parseFloat(val) || 0));
                            pushHistory();
                            setBoards(prev => prev.map(bd =>
                                bd.id === selectedBoard.id
                                    ? { ...bd, taper: { ...normalizeTaper(bd.taper), [key]: v } } : bd
                            ));
                        };
                        const inputStyle = (warn) => ({
                            width: '100%', padding: '5px 8px', background: 'var(--bg-color)', color: 'var(--text-main)',
                            border: `1px solid ${warn ? '#ff3b30' : 'var(--border-color)'}`, borderRadius: '6px', outline: 'none', fontSize: '0.9rem',
                        });

                        return (
                            <div style={{ marginTop: '10px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                                    <div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Left (X−) °</div>
                                        <input type="number" min="0" max="89" step="0.5" value={aL}
                                            onChange={e => setAngle('angleLeft', e.target.value)}
                                            style={inputStyle(xWarn)} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Right (X+) °</div>
                                        <input type="number" min="0" max="89" step="0.5" value={aR}
                                            onChange={e => setAngle('angleRight', e.target.value)}
                                            style={inputStyle(xWarn)} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Front (Z+) °</div>
                                        <input type="number" min="0" max="89" step="0.5" value={aF}
                                            onChange={e => setAngle('angleFront', e.target.value)}
                                            style={inputStyle(zWarn)} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Back (Z−) °</div>
                                        <input type="number" min="0" max="89" step="0.5" value={aB}
                                            onChange={e => setAngle('angleBack', e.target.value)}
                                            style={inputStyle(zWarn)} />
                                    </div>
                                </div>
                                <div style={{ padding: '7px 10px', borderRadius: '6px', fontSize: '0.75rem', background: (xWarn || zWarn) ? 'rgba(255,59,48,0.08)' : 'rgba(60,200,90,0.08)', border: `1px solid ${(xWarn || zWarn) ? 'rgba(255,59,48,0.3)' : 'rgba(60,200,90,0.25)'}`, color: 'var(--text-muted)' }}>
                                    Bottom: <span style={{ color: xWarn ? '#ff3b30' : 'var(--text-main)', fontWeight: 600 }}>X' = {Math.max(0, xBottom).toFixed(3)}"</span> × <span style={{ color: zWarn ? '#ff3b30' : 'var(--text-main)', fontWeight: 600 }}>Z' = {Math.max(0, zBottom).toFixed(3)}"</span>
                                </div>
                                <p className="hint" style={{ marginTop: '6px' }}>Top face is full size. Each side tapers inward independently. Bounding box and constraints use full size.</p>
                            </div>
                        );
                    })()}

                    {selectedBoard.shape === 'cylinder' && (() => {
                        const axis = selectedBoard.cylinder?.axis || 'y';
                        const axisIdx = axis === 'x' ? 0 : axis === 'z' ? 2 : 1;

                        const dim1 = selectedBoard.size[(axisIdx + 1) % 3];
                        const dim2 = selectedBoard.size[(axisIdx + 2) % 3];

                        const radius = selectedBoard.cylinder?.radius ?? Math.min(dim1, dim2) / 2;
                        const height = selectedBoard.size[axisIdx];

                        const setRadius = (val) => {
                            const r = Math.max(0.0625, parseFloat(val) || 0.0625);
                            pushHistory();
                            setBoards(prev => prev.map(bd => {
                                if (bd.id !== selectedBoard.id) return bd;
                                const newSize = [...bd.size];
                                newSize[(axisIdx + 1) % 3] = r * 2;
                                newSize[(axisIdx + 2) % 3] = r * 2;
                                return { ...bd, cylinder: { ...(bd.cylinder || {}), radius: r }, size: newSize };
                            }));
                        };
                        const setHeight = (val) => {
                            const h = Math.max(0.0625, parseFloat(val) || 0.0625);
                            pushHistory();
                            setBoards(prev => prev.map(bd => {
                                if (bd.id !== selectedBoard.id) return bd;
                                const newSize = [...bd.size];
                                newSize[axisIdx] = h;
                                return { ...bd, size: newSize };
                            }));
                        };
                        return (
                            <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Radius (in)</div>
                                    <input
                                        type="number" min="0.0625" step="0.125" value={parseFloat(radius.toFixed(4))}
                                        onChange={e => setRadius(e.target.value)}
                                        style={{ width: '100%', padding: '5px 8px', background: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none', fontSize: '0.9rem' }}
                                    />
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>Diam: {(radius * 2).toFixed(4)}"</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Height (in)</div>
                                    <input
                                        type="number" min="0.0625" step="0.125" value={parseFloat(height.toFixed(4))}
                                        onChange={e => setHeight(e.target.value)}
                                        style={{ width: '100%', padding: '5px 8px', background: 'var(--bg-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none', fontSize: '0.9rem' }}
                                    />
                                </div>
                                <p className="hint" style={{ gridColumn: '1 / -1', marginTop: '2px' }}>
                                    AABB (for constraints): {selectedBoard.size[0].toFixed(3)}" × {selectedBoard.size[1].toFixed(3)}" × {selectedBoard.size[2].toFixed(3)}"
                                </p>
                            </div>
                        );
                    })()}

                    {/* ── Operations Stack ── */}
                    </div>
                    <div className="inspector-card" style={{ marginTop: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h4 style={{ margin: 0 }}>Tools</h4>
                            <button
                                onClick={() => setShowToolsPanel(true)}
                                style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                            >+ Add</button>
                        </div>
                        {(selectedBoard.operations || []).length === 0 ? (
                            <div className="hint" style={{ marginTop: '6px' }}>No tools applied.</div>
                        ) : (
                            (selectedBoard.operations || []).map(op => {
                                const icon = { hole: '◎', cove: '◡', arc: '◠', dado: '✂', miter: '⊿' }[op.type] || '●';
                                const summary = getToolSummary(op);
                                return (
                                    <div key={op.id} style={{
                                        padding: '6px 8px', marginTop: '6px',
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '6px',
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', textTransform: 'capitalize' }}>
                                                {icon} {op.type}
                                            </span>
                                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                <button
                                                    onClick={() => { setEditingToolOpId(op.id); setShowToolsPanel(true); }}
                                                    style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, padding: '1px 5px' }}
                                                >✎ Edit</button>
                                                <button
                                                    onClick={() => removeOperation(selectedBoard.id, op.id)}
                                                    style={{ background: 'none', border: 'none', color: '#ff3b30', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, padding: '1px 5px' }}
                                                >✕</button>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>{summary}</div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                {/* ── Material ── */}
                {(() => {
                    const mat = normalizeMaterial(selectedBoard.material);
                    const swatchColor = getMaterialDisplayColor(selectedBoard.material);
                    const label = mat.type === 'color'
                        ? 'Paint'
                        : (WOOD_CATALOGUE[mat.id]?.label ?? mat.id);
                    return (
                        <div className="inspector-card">
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
                    const JOINT_SEQ = ['Miter', 'Butt 1', 'Butt 2'];
                    const JOINT_DESC = {
                        'Miter': 'Panels overlap — click to make this piece run full',
                        'Butt 1': 'This piece runs full, neighbours trimmed — click to swap',
                        'Butt 2': 'This piece is trimmed, neighbours run full — click to restore',
                    };
                    const JOINT_COLOR = { 'Miter': 'rgba(150,95,188,0.18)', 'Butt 1': 'rgba(188,138,95,0.18)', 'Butt 2': 'rgba(95,150,188,0.18)' };
                    const JOINT_BORDER = { 'Miter': 'rgba(150,95,188,0.7)', 'Butt 1': 'rgba(188,138,95,0.7)', 'Butt 2': 'rgba(95,150,188,0.7)' };
                    const JOINT_TEXT = { 'Miter': '#9a60c0', 'Butt 1': '#bc8a5f', 'Butt 2': '#5fa0c0' };

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
                                    t.size[axisA] = Math.max(0.1, nMax - bb[axisA].min);
                                    t.position[axisA] = (bb[axisA].min + nMax) / 2;
                                } else {
                                    // Neighbour's min protrudes into A → trim its min to A's inner face
                                    const nMin = ba[axisA].max;
                                    t.size[axisA] = Math.max(0.1, bb[axisA].max - nMin);
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
                            const ba = bbOf(selectedBoard);
                            const thiccA = selectedBoard.size[axisA];
                            for (const nb of siblings) {
                                const bb = bbOf(nb);
                                const t = { ...nb, size: [...nb.size], position: [...nb.position] };
                                if (Math.abs(bb[axisA].max - ba[axisA].min) < 0.06) {
                                    t.size[axisA] += thiccA;
                                    t.position[axisA] += thiccA / 2;
                                } else if (Math.abs(bb[axisA].min - ba[axisA].max) < 0.06) {
                                    t.size[axisA] += thiccA;
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
                                const axisB = thinAxis(nbLatest);
                                const baCur = bbOf(ua);
                                const bb = bbOf(nbLatest);
                                if (baCur[axisB].max > bb[axisB].min + 0.01 && baCur[axisB].max <= bb[axisB].max + 0.01) {
                                    const nMax = bb[axisB].min;
                                    ua = { ...ua, size: [...ua.size], position: [...ua.position] };
                                    ua.size[axisB] = Math.max(0.1, nMax - baCur[axisB].min);
                                    ua.position[axisB] = (baCur[axisB].min + nMax) / 2;
                                } else if (baCur[axisB].min < bb[axisB].max - 0.01 && baCur[axisB].min >= bb[axisB].min - 0.01) {
                                    const nMin = bb[axisB].max;
                                    ua = { ...ua, size: [...ua.size], position: [...ua.position] };
                                    ua.size[axisB] = Math.max(0.1, baCur[axisB].max - nMin);
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
                                const axisB = thinAxis(nb);
                                const thiccB = nb.size[axisB];
                                const bb = bbOf(nb);
                                const baCur = bbOf(ua);
                                if (Math.abs(baCur[axisB].max - bb[axisB].min) < 0.06) {
                                    ua = { ...ua, size: [...ua.size], position: [...ua.position] };
                                    ua.size[axisB] += thiccB;
                                    ua.position[axisB] += thiccB / 2;
                                } else if (Math.abs(baCur[axisB].min - bb[axisB].max) < 0.06) {
                                    ua = { ...ua, size: [...ua.size], position: [...ua.position] };
                                    ua.size[axisB] += thiccB;
                                    ua.position[axisB] -= thiccB / 2;
                                }
                            }
                            ua.joint = 'Miter';
                            bds = bds.map(b => b.id === selectedBoard.id ? ua : b);
                        }

                        setBoards(bds);
                    };

                    return (
                        <div className="inspector-card">
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
                {/* ── Dual Rabbet Joint Card ── */}
                {selectedBoard.rabbetJoint && (() => {
                    const rj = selectedBoard.rabbetJoint;
                    const partner = boards.find(b => b.id.toString() === rj.partnerId);
                    const partnerName = partner?.name ?? rj.partnerId;
                    const overBoard = boards.find(b => b.id.toString() === rj.overBoardId);
                    const isOver = overBoard?.id === selectedBoard.id;

                    return (
                        <div className="inspector-card">
                            <h4>🔗 Dual Rabbet Joint</h4>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-main)', flex: 1 }}>
                                    {isOver ? (
                                        <><strong>{selectedBoard.name}</strong> over <strong>{partnerName}</strong></>
                                    ) : (
                                        <><strong>{partnerName}</strong> over <strong>{selectedBoard.name}</strong></>
                                    )}
                                </span>
                                <button
                                    onClick={() => toggleRabbetJoint(selectedBoard.id)}
                                    title="Flip dual rabbet joint"
                                    style={{
                                        padding: '3px 10px', fontSize: '0.72rem', fontWeight: 600,
                                        background: 'rgba(100,180,255,0.12)', border: '1px solid rgba(100,180,255,0.4)',
                                        borderRadius: '5px', color: '#64b4ff', cursor: 'pointer',
                                    }}
                                >⇄</button>
                                <button
                                    onClick={() => removeRabbetJoint(selectedBoard.id)}
                                    title="Remove dual rabbet joint"
                                    style={{
                                        padding: '3px 8px', fontSize: '0.72rem', fontWeight: 600,
                                        background: 'none', border: 'none', color: '#ff3b30', cursor: 'pointer',
                                    }}
                                >✕</button>
                            </div>
                        </div>
                    );
                })()}
                <div className="inspector-card">
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
                                const axisLabel = c.type === 'Flush' ? ` (${['X', 'Y', 'Z'][c.axis]} axis)` : '';
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
                <div className="inspector-card">
                    <h4>Parent Node:</h4>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '8px' }}><strong>{selectedBoard.parentId}</strong></div>
                </div>
                <div className="inspector-card">
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
